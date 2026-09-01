import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { supabase } from "@/lib/supabase";
import { playbackUrl } from "@/lib/mux";
import { buildAdTagUrl } from "@/lib/ads";
import { FoundVideoPlayer } from "@/components/FoundVideoPlayer";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { useAuth } from "@/hooks/useAuth";
import type { Film } from "@/types/database";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

const AD_UNIT_PATH = "/6499/example/found-preroll";

export function PlayerScreen({ route }: Props) {
  const { filmId } = route.params;
  const { session } = useAuth();
  const [film, setFilm] = useState<Film | null>(null);
  const lastSavedProgress = useRef(0);

  useEffect(() => {
    supabase
      .from("films")
      .select("*")
      .eq("id", filmId)
      .single()
      .then(({ data }) => setFilm(data));
    supabase.rpc("increment_view_count", { p_film_id: filmId });
  }, [filmId]);

  const handleProgress = (seconds: number) => {
    // Persist at most once every 10s of playback rather than on every
    // onProgress tick (react-native-video fires those every ~250ms).
    if (seconds - lastSavedProgress.current < 10) return;
    lastSavedProgress.current = seconds;
    if (!session) return;
    supabase
      .from("watch_history")
      .upsert({ user_id: session.user.id, film_id: filmId, progress_seconds: seconds })
      .then();
  };

  const handleComplete = () => {
    if (!session) return;
    supabase
      .from("watch_history")
      .upsert({ user_id: session.user.id, film_id: filmId, progress_seconds: 0, completed: true })
      .then();
  };

  if (!film) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!film.mux_playback_id) {
    return (
      <View style={styles.loading}>
        <Text style={styles.notReady}>This film is still processing. Try again shortly.</Text>
      </View>
    );
  }

  const adTagUrl =
    film.ad_tag_url ??
    (Constants.expoConfig?.extra?.adTagUrlBase
      ? buildAdTagUrl(Constants.expoConfig.extra.adTagUrlBase, {
          adUnitPath: AD_UNIT_PATH,
          filmId: film.id,
          durationSeconds: film.duration_seconds ?? 0,
        })
      : null);

  return (
    <SubscriptionGate isFreePreview={film.is_free_preview}>
      <View style={styles.container}>
        <FoundVideoPlayer
          playbackUrl={playbackUrl(film.mux_playback_id)}
          adTagUrl={adTagUrl}
          onProgress={handleProgress}
          onComplete={handleComplete}
        />
        <Text style={styles.title}>{film.title}</Text>
      </View>
    </SubscriptionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  loading: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  notReady: { color: "#9A9AA5", padding: 24, textAlign: "center" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", padding: 20 },
});

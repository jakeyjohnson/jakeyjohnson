import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { supabase } from "@/lib/supabase";
import { thumbnailUrl } from "@/lib/mux";
import type { Film } from "@/types/database";

type Props = NativeStackScreenProps<RootStackParamList, "FilmDetail">;

export function FilmDetailScreen({ route, navigation }: Props) {
  const { filmId } = route.params;
  const [film, setFilm] = useState<Film | null>(null);

  useEffect(() => {
    supabase
      .from("films")
      .select("*")
      .eq("id", filmId)
      .single()
      .then(({ data }) => setFilm(data));
  }, [filmId]);

  if (!film) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const uri = film.thumbnail_url ?? (film.mux_playback_id ? thumbnailUrl(film.mux_playback_id) : undefined);

  return (
    <ScrollView style={styles.container}>
      {uri ? <Image source={{ uri }} style={styles.hero} /> : <View style={[styles.hero, styles.heroPlaceholder]} />}

      <View style={styles.body}>
        <Text style={styles.title}>{film.title}</Text>
        {film.genre ? <Text style={styles.genre}>{film.genre}</Text> : null}
        {film.synopsis ? <Text style={styles.synopsis}>{film.synopsis}</Text> : null}

        <Pressable
          style={styles.playButton}
          onPress={() => navigation.navigate("Player", { filmId: film.id })}
        >
          <Text style={styles.playButtonText}>▶  Play</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  loading: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", aspectRatio: 16 / 9 },
  heroPlaceholder: { backgroundColor: "#1C1C22" },
  body: { padding: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  genre: { color: "#9A9AA5", marginTop: 6 },
  synopsis: { color: "#D0D0D8", marginTop: 16, lineHeight: 22 },
  playButton: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  playButtonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
});

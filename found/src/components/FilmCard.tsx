import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Film } from "@/types/database";
import { thumbnailUrl } from "@/lib/mux";

interface Props {
  film: Film;
  onPress: (film: Film) => void;
}

export function FilmCard({ film, onPress }: Props) {
  const uri = film.thumbnail_url ?? (film.mux_playback_id ? thumbnailUrl(film.mux_playback_id) : undefined);

  return (
    <Pressable style={styles.card} onPress={() => onPress(film)}>
      <View style={styles.thumbnailWrap}>
        {uri ? <Image source={{ uri }} style={styles.thumbnail} /> : <View style={styles.thumbnailPlaceholder} />}
        {film.duration_seconds ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(film.duration_seconds)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {film.title}
      </Text>
      {film.genre ? <Text style={styles.genre}>{film.genre}</Text> : null}
    </Pressable>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  card: { width: 160, marginRight: 12 },
  thumbnailWrap: { width: 160, height: 90, borderRadius: 8, overflow: "hidden", backgroundColor: "#1C1C22" },
  thumbnail: { width: "100%", height: "100%" },
  thumbnailPlaceholder: { width: "100%", height: "100%", backgroundColor: "#1C1C22" },
  durationBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: "#fff", fontSize: 11 },
  title: { color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 6 },
  genre: { color: "#9A9AA5", fontSize: 12, marginTop: 2 },
});

import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useFilms } from "@/hooks/useFilms";
import { FilmCard } from "@/components/FilmCard";
import type { Film } from "@/types/database";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { films, loading, reload } = useFilms();

  const sections = useMemo(() => {
    const byGenre = new Map<string, Film[]>();
    for (const film of films) {
      const key = film.genre ?? "More to explore";
      byGenre.set(key, [...(byGenre.get(key) ?? []), film]);
    }
    return Array.from(byGenre, ([title, data]) => ({ title, data: [data] }));
  }, [films]);

  if (loading && films.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(_, index) => String(index)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#fff" />}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <Text style={styles.header}>Found</Text>
          <Pressable onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.profileLink}>Profile</Text>
          </Pressable>
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
      renderItem={({ item }) => (
        <FlatList
          horizontal
          data={item}
          keyExtractor={(film) => film.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          renderItem={({ item: film }) => (
            <FilmCard film={film} onPress={(f) => navigation.navigate("FilmDetail", { filmId: f.id })} />
          )}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No films yet — check back soon, or upload the first one from your profile.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  loading: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 8,
  },
  header: { color: "#fff", fontSize: 28, fontWeight: "800" },
  profileLink: { color: "#9A9AA5", fontSize: 14, fontWeight: "600" },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  row: { paddingHorizontal: 20 },
  empty: { color: "#9A9AA5", textAlign: "center", marginTop: 60, paddingHorizontal: 40 },
});

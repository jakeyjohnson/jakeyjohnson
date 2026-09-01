import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useMyFilms } from "@/hooks/useFilms";
import { useSubscription } from "@/hooks/useSubscription";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

const STATUS_LABEL: Record<string, string> = {
  uploading: "Uploading…",
  processing: "Processing",
  pending_review: "In review",
  approved: "Live",
  rejected: "Rejected",
};

export function ProfileScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { films } = useMyFilms(session?.user.id);
  const { isSubscribed } = useSubscription();

  return (
    <View style={styles.container}>
      <Text style={styles.email}>{session?.user.email}</Text>
      <Text style={styles.status}>{isSubscribed ? "Found+ subscriber" : "Not subscribed"}</Text>

      {!isSubscribed && (
        <Pressable style={styles.linkButton} onPress={() => navigation.navigate("Subscription")}>
          <Text style={styles.linkButtonText}>Subscribe for $2.99/mo</Text>
        </Pressable>
      )}

      <Pressable style={styles.linkButton} onPress={() => navigation.navigate("Upload")}>
        <Text style={styles.linkButtonText}>Upload a film</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>My uploads</Text>
      <FlatList
        data={films}
        keyExtractor={(film) => film.id}
        renderItem={({ item }) => (
          <View style={styles.filmRow}>
            <Text style={styles.filmTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.filmStatus}>{STATUS_LABEL[item.status]}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>You haven't uploaded any films yet.</Text>}
      />

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
  email: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 20 },
  status: { color: "#9A9AA5", marginTop: 4, marginBottom: 20 },
  linkButton: { backgroundColor: "#17171D", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  linkButtonText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 10 },
  filmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomColor: "#1C1C22",
    borderBottomWidth: 1,
  },
  filmTitle: { color: "#fff", flex: 1, marginRight: 12 },
  filmStatus: { color: "#9A9AA5" },
  empty: { color: "#6B6B75", marginTop: 8 },
  signOut: { marginTop: "auto", paddingVertical: 16, alignItems: "center" },
  signOutText: { color: "#FF6B6B", fontWeight: "600" },
});

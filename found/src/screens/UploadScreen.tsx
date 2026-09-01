import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { createUploadTarget, uploadFileToMux } from "@/lib/mux";

/**
 * Uploads go straight from the device to Mux via a signed direct-upload URL
 * (see supabase/functions/create-mux-upload) — the file never passes through
 * our own server, so there's no server bandwidth/storage bill for video.
 * The film starts in 'uploading' status; a Mux webhook flips it to
 * 'processing' then 'pending_review' once Mux finishes transcoding, and it
 * only becomes visible in the catalogue after manual moderation approves it.
 */
export function UploadScreen() {
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [genre, setGenre] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setTitle("");
    setSynopsis("");
    setGenre("");
    setProgress(null);
    setDone(false);
  };

  const handlePickAndUpload = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give your film a title before uploading.");
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({ type: "video/*" });
    if (picked.canceled || !picked.assets[0]) return;

    try {
      setProgress(0);
      const target = await createUploadTarget({
        title: title.trim(),
        synopsis: synopsis.trim(),
        genre: genre.trim(),
      });
      await uploadFileToMux(target.uploadUrl, picked.assets[0].uri, setProgress);
      setDone(true);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Something went wrong.");
      setProgress(null);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Uploaded</Text>
        <Text style={styles.subtitle}>
          Found is now transcoding your film. It'll appear in "My uploads" once processing finishes, and go live
          after review.
        </Text>
        <Pressable style={styles.button} onPress={reset}>
          <Text style={styles.buttonText}>Upload another</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload a film</Text>

      <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#6B6B75" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Synopsis"
        placeholderTextColor="#6B6B75"
        value={synopsis}
        onChangeText={setSynopsis}
        multiline
      />
      <TextInput style={styles.input} placeholder="Genre" placeholderTextColor="#6B6B75" value={genre} onChangeText={setGenre} />

      {progress !== null ? (
        <View style={styles.progressWrap}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.progressText}>Uploading… {progress}%</Text>
        </View>
      ) : (
        <Pressable style={styles.button} onPress={handlePickAndUpload}>
          <Text style={styles.buttonText}>Choose video file</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 24, justifyContent: "center" },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 20, textAlign: "center" },
  subtitle: { color: "#9A9AA5", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  input: {
    backgroundColor: "#17171D",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  button: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0B0B0F", fontWeight: "700" },
  progressWrap: { alignItems: "center", marginTop: 20 },
  progressText: { color: "#9A9AA5", marginTop: 10 },
});

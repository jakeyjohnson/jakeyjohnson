import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/RootNavigator";
import { signUpWithEmail } from "@/hooks/useAuth";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email.trim(), password, displayName.trim());
      setCheckEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {email}. Tap it, then come back and sign in.
        </Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate("SignIn")}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Create account</Text>

      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor="#6B6B75"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B6B75"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min. 6 characters)"
        placeholderTextColor="#6B6B75"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#0B0B0F" /> : <Text style={styles.buttonText}>Create account</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("SignIn")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", justifyContent: "center", padding: 24 },
  logo: { color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 24 },
  subtitle: { color: "#9A9AA5", textAlign: "center", marginBottom: 24 },
  input: {
    backgroundColor: "#17171D",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  button: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0B0B0F", fontWeight: "700" },
  link: { color: "#9A9AA5", textAlign: "center", marginTop: 20 },
  error: { color: "#FF6B6B", marginBottom: 8 },
});

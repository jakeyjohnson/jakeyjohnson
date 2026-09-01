import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { purchaseMonthlyPackage, restorePurchases } from "@/lib/revenuecat";
import { useSubscription } from "@/hooks/useSubscription";

const BENEFITS = [
  "Unlimited short films, no rentals or per-title fees",
  "New premieres added every week",
  "Fewer ad breaks than the free preview tier",
  "Support independent filmmakers directly",
];

/**
 * The paywall. The $2.99/mo price itself lives in App Store Connect (the
 * "monthly" subscription product) and RevenueCat's offering config, not in
 * this file — this screen just triggers the purchase flow and reflects
 * whatever price App Store Connect returns for the shopper's storefront.
 */
export function SubscriptionScreen() {
  const { isSubscribed, refresh } = useSubscription();
  const [busy, setBusy] = useState(false);

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const subscribed = await purchaseMonthlyPackage();
      if (subscribed) await refresh();
    } catch (err: any) {
      if (!err?.userCancelled) {
        Alert.alert("Purchase failed", err?.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const restored = await restorePurchases();
      await refresh();
      if (!restored) Alert.alert("Nothing to restore", "No active subscription was found on this Apple ID.");
    } catch (err: any) {
      Alert.alert("Restore failed", err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (isSubscribed) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>You're subscribed</Text>
        <Text style={styles.subtitle}>Enjoy Found ad-light, with full access to the catalogue.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Found+</Text>
      <Text style={styles.price}>$2.99/month</Text>

      <View style={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <Text key={benefit} style={styles.benefit}>
            •  {benefit}
          </Text>
        ))}
      </View>

      <Pressable style={styles.button} onPress={handleSubscribe} disabled={busy}>
        {busy ? <ActivityIndicator color="#0B0B0F" /> : <Text style={styles.buttonText}>Subscribe</Text>}
      </Pressable>

      <Pressable onPress={handleRestore} disabled={busy}>
        <Text style={styles.link}>Restore purchases</Text>
      </Pressable>

      <Text style={styles.legal}>
        Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew automatically unless
        cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID
        account settings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 24, justifyContent: "center" },
  title: { color: "#fff", fontSize: 32, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#9A9AA5", textAlign: "center", marginTop: 8 },
  price: { color: "#fff", fontSize: 18, textAlign: "center", marginTop: 8, marginBottom: 24 },
  benefits: { marginBottom: 32 },
  benefit: { color: "#D0D0D8", fontSize: 15, marginBottom: 10, lineHeight: 20 },
  button: { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
  link: { color: "#9A9AA5", textAlign: "center", marginTop: 16 },
  legal: { color: "#5C5C66", fontSize: 11, textAlign: "center", marginTop: 24, lineHeight: 16 },
});

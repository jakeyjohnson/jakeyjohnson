import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionScreen } from "@/screens/SubscriptionScreen";

interface Props {
  /** Free-preview content bypasses the gate entirely regardless of subscription state. */
  isFreePreview?: boolean;
  children: ReactNode;
}

/** Wrap any screen/section that should only render for active subscribers. */
export function SubscriptionGate({ isFreePreview = false, children }: Props) {
  const { isSubscribed } = useSubscription();

  if (isFreePreview) return <>{children}</>;

  if (isSubscribed === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!isSubscribed) return <SubscriptionScreen />;

  return <>{children}</>;
}

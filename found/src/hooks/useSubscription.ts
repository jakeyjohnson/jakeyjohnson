import { useCallback, useEffect, useState } from "react";
import { getCurrentEntitlement } from "@/lib/revenuecat";
import { useAuth } from "@/hooks/useAuth";

/**
 * Reads subscription state straight from RevenueCat's local cache (fast,
 * works offline) rather than the `subscriptions` Supabase table, which only
 * exists so other backend logic (e.g. moderation, analytics) can see it —
 * the app itself always defers to RevenueCat as the source of truth for
 * gating playback, since that's what's authoritative with Apple/Google.
 */
export function useSubscription() {
  const { session } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setIsSubscribed(false);
      return;
    }
    try {
      setIsSubscribed(await getCurrentEntitlement());
    } catch (err) {
      console.warn("[subscription] failed to read entitlement:", err);
      setIsSubscribed(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isSubscribed, refresh };
}

import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { type CustomerInfo } from "react-native-purchases";

const { revenueCatApiKeyIos, revenueCatApiKeyAndroid, revenueCatEntitlementId } =
  Constants.expoConfig?.extra ?? {};

export const ENTITLEMENT_ID: string = revenueCatEntitlementId ?? "subscriber";

let configured = false;

/**
 * Call once after the user's Supabase id is known, so RevenueCat's
 * app_user_id lines up with our own user id (see revenuecat-webhook, which
 * relies on that to know which Supabase row to update).
 */
export function configurePurchases(appUserId: string) {
  const apiKey = Platform.select({ ios: revenueCatApiKeyIos, android: revenueCatApiKeyAndroid });
  if (!apiKey) {
    throw new Error("Missing REVENUECAT_API_KEY_IOS / REVENUECAT_API_KEY_ANDROID in .env");
  }
  if (configured) return;
  Purchases.configure({ apiKey, appUserID: appUserId });
  configured = true;
}

export function isEntitled(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
}

export async function getCurrentEntitlement(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return isEntitled(info);
}

export async function fetchOfferings() {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchaseMonthlyPackage() {
  const current = await fetchOfferings();
  const monthly = current?.monthly;
  if (!monthly) {
    throw new Error(
      "No 'monthly' package found on the current RevenueCat offering. Check the $rc_monthly package is attached to the default offering in the RevenueCat dashboard."
    );
  }
  const { customerInfo } = await Purchases.purchasePackage(monthly);
  return isEntitled(customerInfo);
}

export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  return isEntitled(info);
}

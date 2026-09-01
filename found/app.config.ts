import type { ExpoConfig } from "expo/config";

// Values that differ between environments are read from process.env so the
// same config works for local dev, EAS builds, and CI without editing code.
// See .env.example for the full list.
const config: ExpoConfig = {
  name: "Found",
  slug: "found",
  scheme: "found",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    backgroundColor: "#0B0B0F",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "co.jakejohnson.found",
    supportsTablet: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "Found needs access to your library so you can pick a video to upload.",
      NSMicrophoneUsageDescription:
        "Found needs microphone access to play audio for uploaded films.",
    },
  },
  android: {
    package: "co.jakejohnson.found",
    permissions: ["READ_EXTERNAL_STORAGE", "READ_MEDIA_VIDEO"],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0B0B0F",
    },
  },
  plugins: [
    // react-native-video ships its own IMA SDK integration; this flag adds
    // the native ADS extension (Google IMA) to the generated iOS/Android
    // projects during `expo prebuild`. See
    // https://docs.thewidlarzgroup.com/react-native-video/component/ads
    ["react-native-video", { enableADSExtension: true }],
  ],
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    revenueCatApiKeyIos: process.env.REVENUECAT_API_KEY_IOS,
    revenueCatApiKeyAndroid: process.env.REVENUECAT_API_KEY_ANDROID,
    revenueCatEntitlementId: process.env.REVENUECAT_ENTITLEMENT_ID ?? "subscriber",
    adTagUrlBase: process.env.AD_TAG_URL_BASE,
  },
};

export default config;

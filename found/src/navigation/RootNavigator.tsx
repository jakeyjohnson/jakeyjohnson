import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { SignInScreen } from "@/screens/SignInScreen";
import { SignUpScreen } from "@/screens/SignUpScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { FilmDetailScreen } from "@/screens/FilmDetailScreen";
import { PlayerScreen } from "@/screens/PlayerScreen";
import { UploadScreen } from "@/screens/UploadScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { SubscriptionScreen } from "@/screens/SubscriptionScreen";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  FilmDetail: { filmId: string };
  Player: { filmId: string };
  Upload: undefined;
  Profile: undefined;
  Subscription: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#0B0B0F", card: "#0B0B0F" },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0B0B0F" }, headerTintColor: "#fff" }}>
      <RootStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="FilmDetail" component={FilmDetailScreen} options={{ title: "" }} />
      <RootStack.Screen name="Player" component={PlayerScreen} options={{ title: "" }} />
      <RootStack.Screen name="Upload" component={UploadScreen} options={{ title: "Upload" }} />
      <RootStack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <RootStack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: "Found+" }} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const auth = useAuthProvider();

  if (auth.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer theme={theme}>{auth.session ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>
    </AuthContext.Provider>
  );
}

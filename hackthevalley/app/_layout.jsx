import { Stack } from "expo-router";
import { ThemeProvider, ThemeContext } from "../contexts/ThemeContext";
import { useFonts } from "expo-font";
import AppLoading from "expo-app-loading";
import React, { useContext } from "react";

function ThemedStack() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily } = themeStyles;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontFamily },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name='index' options={{ title: "Home" }} />
      <Stack.Screen name='camera-page' options={{ title: "Camera Page" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DyslexiaFont: require("../assets/fonts/OpenDyslexic3-Regular.ttf"),
  });
  if (!fontsLoaded) return <AppLoading />;

  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

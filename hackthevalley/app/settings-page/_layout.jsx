import { Stack } from "expo-router";
import { ThemeProvider } from "@/contexts/ThemeContext";

const SettingsLayout = () => {
  return <Stack screenOptions={{ headerShown: false }} />;
};

export default SettingsLayout;

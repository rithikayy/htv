import { Stack } from "expo-router";
import { ThemeProvider } from "@/contexts/ThemeContext";

const CameraLayout = () => {
  return <Stack screenOptions={{ headerShown: false }} />;
};

export default CameraLayout;

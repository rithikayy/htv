import AppLoading from "expo-app-loading";
import { useFonts } from "expo-font";
import { useContext } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { ThemeContext } from "../contexts/ThemeContext";

export default function HomeScreen() {
  const { highContrast, setHighContrast, dyslexiaFont, setDyslexiaFont } =
    useContext(ThemeContext);

  const [fontsLoaded] = useFonts({
    DyslexiaFont: require("../assets/fonts/OpenDyslexic3-Regular.ttf"),
  });

  if (!fontsLoaded) return <AppLoading />;

  return (
    <View
      style={[styles.container, highContrast && styles.highContrastBackground]}
    >
      <Text
        style={[
          styles.text,
          highContrast && styles.highContrastText,
          dyslexiaFont && { fontFamily: "DyslexiaFont" },
        ]}
      >
        Accessibility Demo
      </Text>

      <View style={styles.toggleRow}>
        <Text
          style={[styles.text, dyslexiaFont && { fontFamily: "DyslexiaFont" }]}
        >
          High Contrast
        </Text>
        <Switch value={highContrast} onValueChange={setHighContrast} />
      </View>

      <View style={styles.toggleRow}>
        <Text
          style={[styles.text, dyslexiaFont && { fontFamily: "DyslexiaFont" }]}
        >
          Dyslexia Font
        </Text>
        <Switch value={dyslexiaFont} onValueChange={setDyslexiaFont} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  text: {
    fontSize: 20,
    marginBottom: 30,
    color: "#333",
  },
  highContrastBackground: {
    backgroundColor: "#000",
  },
  highContrastText: {
    color: "#FFD700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  label: {
    fontSize: 18,
    marginRight: 10,
    color: "#333",
  },
});

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
      <View style={styles.testContainer}>
        <View style={styles.toggleRow}>
          <Text style={styles.label}>High Contrast</Text>
          <View style={styles.switchContainer}>
            <Switch value={highContrast} onValueChange={setHighContrast} />
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Dyslexia Font</Text>
          <View style={styles.switchContainer}>
            <Switch value={dyslexiaFont} onValueChange={setDyslexiaFont} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  testContainer: {
    flexDirection: "row",
  },
  switchContainer: {
    marginRight: 10,
  },
  text: {
    fontSize: 20,
    marginBottom: 30,
    color: "#333",
  },
  highContrastBackground: {
    backgroundColor: "#fff",
  },
  highContrastText: {
    color: "#000",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  label: {
    fontSize: 18,
    marginRight: 5,
    color: "#333",
  },
});

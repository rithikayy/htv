import React, { useContext } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { ThemeContext } from "../contexts/ThemeContext";
import { useRouter } from "expo-router";

const HomeScreen = () => {
  const router = useRouter();
  const {
    highContrast,
    dyslexiaFont,
    toggleHighContrast,
    toggleDyslexiaFont,
    themeStyles,
  } = useContext(ThemeContext);

  const { colors, fontFamily } = themeStyles;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => router.push("/camera-page")}
          style={[styles.button, { backgroundColor: colors.buttonBackground }]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: colors.buttonText, fontFamily },
            ]}
          >
            Turn on camera
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toggleContainer}>
        <View style={styles.toggleRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            High Contrast
          </Text>
          <View style={styles.switchContainer}>
            <Switch value={highContrast} onValueChange={toggleHighContrast} />
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            Dyslexia Font
          </Text>
          <View style={styles.switchContainer}>
            <Switch value={dyslexiaFont} onValueChange={toggleDyslexiaFont} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  buttonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 20,
  },
  toggleContainer: {
    flexDirection: "row",
    padding: 20,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  label: {
    fontSize: 18,
    marginRight: 10,
  },
  switchContainer: {
    marginRight: 5,
  },
});

export default HomeScreen;

import React, { useContext } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ThemeContext } from "../contexts/ThemeContext";
import { useRouter } from "expo-router";

const HomeScreen = () => {
  const router = useRouter();
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;

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
              {
                color: colors.buttonText,
                fontFamily,
                fontSize: Math.round(16 * fontSizeMultiplier),
              },
            ]}
          >
            Turn on camera
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          onPress={() => router.push("/settings-page")}
          style={[
            styles.settingsButton,
            { backgroundColor: colors.buttonBackground },
          ]}
        >
          <Text
            style={[
              styles.settingsButtonText,
              {
                color: colors.buttonText,
                fontFamily,
                fontSize: Math.round(16 * fontSizeMultiplier),
              },
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
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
  bottomContainer: {
    padding: 20,
  },
  settingsButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "center",
  },
  settingsButtonText: {
    fontSize: 16,
  },
});

export default HomeScreen;

import React, { useContext } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { ThemeContext } from "../../contexts/ThemeContext";

const SettingsScreen = () => {
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
      <View style={styles.toggleRow}>
        <Text style={[styles.label, { color: colors.text, fontFamily }]}>
          High Contrast
        </Text>
        <Switch value={highContrast} onValueChange={toggleHighContrast} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={[styles.label, { color: colors.text, fontFamily }]}>
          Dyslexia Font
        </Text>
        <Switch value={dyslexiaFont} onValueChange={toggleDyslexiaFont} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
    paddingVertical: 10,
  },
  label: {
    fontSize: 18,
  },
});

export default SettingsScreen;

import React, { useContext } from "react";
import { StyleSheet, Switch, Text, View, TouchableOpacity } from "react-native";
import { ThemeContext } from "../../contexts/ThemeContext";

const SettingsScreen = () => {
  const {
    highContrast,
    dyslexiaFont,
    fontSize,
    toggleHighContrast,
    toggleDyslexiaFont,
    setFontSize,
    themeStyles,
  } = useContext(ThemeContext);

  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;

  const fontSizeOptions = ["small", "medium", "large"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toggleRow, { backgroundColor: colors.buttonBackground, borderRadius: 12, padding: 15, borderWidth: 2, borderColor: colors.border }]}>
        <Text
          style={[
            styles.label,
            {
              color: colors.buttonText,
              fontFamily,
              fontSize: Math.round(18 * fontSizeMultiplier),
            },
          ]}
        >
          High Contrast
        </Text>
        <Switch 
          value={highContrast} 
          onValueChange={toggleHighContrast}
          trackColor={{ false: colors.border, true: colors.text }}
          thumbColor={highContrast ? colors.buttonBackground : colors.background}
        />
      </View>

      <View style={[styles.toggleRow, { backgroundColor: colors.buttonBackground, borderRadius: 12, padding: 15, borderWidth: 2, borderColor: colors.border }]}>
        <Text
          style={[
            styles.label,
            {
              color: colors.buttonText,
              fontFamily,
              fontSize: Math.round(18 * fontSizeMultiplier),
            },
          ]}
        >
          Dyslexia Font
        </Text>
        <Switch 
          value={dyslexiaFont} 
          onValueChange={toggleDyslexiaFont}
          trackColor={{ false: colors.border, true: colors.text }}
          thumbColor={dyslexiaFont ? colors.buttonBackground : colors.background}
        />
      </View>

      <View style={[styles.fontSizeSection, { backgroundColor: colors.buttonBackground, borderRadius: 12, padding: 15, borderWidth: 2, borderColor: colors.border }]}>
        <Text
          style={[
            styles.label,
            {
              color: colors.buttonText,
              fontFamily,
              fontSize: Math.round(18 * fontSizeMultiplier),
            },
          ]}
        >
          Font Size
        </Text>
        <View style={styles.buttonGroup}>
          {fontSizeOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.fontSizeButton,
                {
                  backgroundColor: fontSize === option ? colors.text : colors.background,
                  borderColor: colors.border,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setFontSize(option)}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: fontSize === option ? colors.background : colors.text,
                    fontFamily,
                    fontSize: Math.round(16 * fontSizeMultiplier),
                  },
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fontSizeSection: {
    marginVertical: 10,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  fontSizeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SettingsScreen;
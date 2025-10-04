import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/contexts/ThemeContext";

const CameraPage = () => {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily } = themeStyles;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text, fontFamily }]}>
        Camera Page — content here
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // other layout styles
  },
  text: {
    fontSize: 20,
  },
});

export default CameraPage;

import React, { useContext } from "react";
import { View, Text, StyleSheet, Button, TouchableOpacity } from "react-native";
import { ThemeContext } from "@/contexts/ThemeContext";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";

export default function CameraPage() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily } = themeStyles;

  // In a JS/JSX file: no generic syntax
  const [facing, setFacing] = React.useState("back");
  const [permission, requestPermission] = useCameraPermissions();

  // Guard: if useCameraPermissions didn’t return yet
  if (!permission) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      />
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text, fontFamily }]}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title='Grant Permission' />
      </View>
    );
  }

  function toggleFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CameraView style={styles.camera} facing={facing} />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={toggleFacing}>
          <Text style={[styles.text, { color: colors.text, fontFamily }]}>
            Flip Camera
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 64,
    flexDirection: "row",
    backgroundColor: "transparent",
    width: "100%",
    paddingHorizontal: 64,
  },
  button: {
    flex: 1,
    alignItems: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
  },
});

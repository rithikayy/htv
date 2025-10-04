import React, { useContext, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { ThemeContext } from "@/contexts/ThemeContext";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";

export default function CameraPage() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily } = themeStyles;

  const [facing, setFacing] = React.useState("back");
  const [permission, requestPermission, getPermission] = useCameraPermissions();

  useEffect(() => {}, [permission]);

  function toggleFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  function openSettings() {
    Linking.openSettings().catch((err) => {
      console.warn("could not open settings", err);
    });
  }

  if (!permission) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      />
    );
  }

  if (!permission.granted) {
    if (permission.canAskAgain) {
      return (
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.message, { color: colors.text, fontFamily }]}>
            We need your permission to show the camera
          </Text>
          <Button onPress={requestPermission} title='Grant Permission' />
        </View>
      );
    } else {
      return (
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.message, { color: colors.text, fontFamily }]}>
            Camera permission was denied. To use the camera, go to Settings and
            allow camera access.
          </Text>
          <Button onPress={openSettings} title='Open Settings' />
        </View>
      );
    }
  }

  return (
    <View
      style={[styles.cameraContainer, { backgroundColor: colors.background }]}
    >
      <CameraView style={styles.camera} facing={facing} />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={toggleFacing}>
          <Text style={[styles.text, { color: colors.buttonText, fontFamily }]}>
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
    padding: 10,
    justifyContent: "center",
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
    borderRadius: 8,
    marginBottom: 30,
  },
  cameraContainer: {
    borderRadius: 8,
    flex: 1,
    padding: 10,
    justifyContent: "center",
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

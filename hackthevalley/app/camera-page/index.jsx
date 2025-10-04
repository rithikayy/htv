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

  // Hardcoded bounding boxes for testing
  // TODO: Replace with actual data from backend API
  // Format: { x, y, width, height, label, confidence }
  // x, y, width, height are in percentage (0-1) relative to camera view
  const boundingBoxes = [
    {
      x: 0.1,
      y: 0.15,
      width: 0.3,
      height: 0.4,
      label: "person",
      confidence: 0.95,
    },
    {
      x: 0.5,
      y: 0.3,
      width: 0.35,
      height: 0.45,
      label: "car",
      confidence: 0.87,
    },
    {
      x: 0.2,
      y: 0.65,
      width: 0.25,
      height: 0.2,
      label: "dog",
      confidence: 0.92,
    },
  ];

  // When backend is ready, use this instead:
  // const [boundingBoxes, setBoundingBoxes] = React.useState([]);
  // Then update with: setBoundingBoxes(dataFromBackend);

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
      <View style={styles.cameraWrapper}>
        <CameraView style={styles.camera} facing={facing}>
          {/* Bounding boxes overlay */}
          {boundingBoxes.map((box, index) => (
            <View
              key={index}
              style={[
                styles.boundingBox,
                {
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                },
              ]}
            >
              {box.label && (
                <View style={styles.labelContainer}>
                  <Text style={styles.labelText}>
                    {box.label}{" "}
                    {box.confidence
                      ? `${Math.round(box.confidence * 100)}%`
                      : ""}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </CameraView>
      </View>

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
  cameraWrapper: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 30,
  },
  camera: {
    flex: 1,
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
  boundingBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00FF00",
    backgroundColor: "transparent",
  },
  labelContainer: {
    position: "absolute",
    top: -20,
    left: 0,
    backgroundColor: "#00FF00",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  labelText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "bold",
  },
});

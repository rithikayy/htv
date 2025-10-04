import React, { useContext, useEffect, useRef } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";

export default function CameraPage() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;
  const [facing, setFacing] = React.useState("back");
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const cameraRef = useRef(null);
  const frameCountRef = useRef(0);
  const isCapturingRef = useRef(false);

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

  useEffect(() => {
    if (permission?.granted && isCameraReady) {
      console.log(
        "Camera permission granted and camera ready, starting frame capture..."
      );
      startFrameCapture();
    }

    return () => {
      // Cleanup on unmount
      console.log("Stopping frame capture...");
      isCapturingRef.current = false;
    };
  }, [permission, isCameraReady]);

  async function captureAndProcessFrame() {
    if (!cameraRef.current || !isCapturingRef.current) {
      console.log("Cannot capture: camera ref or capturing flag not ready");
      return;
    }

    try {
      console.log("Capturing frame...");
      // Capture the frame
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      console.log("Frame captured, processing...");
      // Compress and resize the image
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 320 } }], // Resize to 640px width, height auto-calculated
        {
          compress: 0.7, // 70% quality
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      // Prepare the payload that would be sent to backend
      const payload = {
        image: manipulatedImage.base64,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        timestamp: Date.now(),
        cameraFacing: facing,
      };

      // Log the payload (would be sent to backend in production)
      console.log("Frame captured and processed:", {
        timestamp: payload.timestamp,
        width: payload.width,
        height: payload.height,
        cameraFacing: payload.cameraFacing,
        base64: payload.image,
      });

      // In production, you would send to backend here:
      // await fetch('YOUR_BACKEND_URL/process-frame', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });
    } catch (error) {
      console.error("Error capturing frame:", error);
    }
  }

  function startFrameCapture() {
    console.log("Starting frame capture loop...");
    isCapturingRef.current = true;
    captureFrames();
  }

  async function captureFrames() {
    console.log("Frame capture loop started");
    while (isCapturingRef.current) {
      frameCountRef.current++;

      // Capture every 30th frame
      if (frameCountRef.current % 30 === 0) {
        console.log(`Frame #${frameCountRef.current} - triggering capture`);
        await captureAndProcessFrame();
      }

      // Wait for next frame (approximately 60 FPS = ~16ms per frame)
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    console.log("Frame capture loop ended");
  }

  function toggleFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  function openSettings() {
    Linking.openSettings().catch((err) => {
      console.warn("could not open settings", err);
    });
  }

  function handleCameraReady() {
    console.log("Camera is ready!");
    setIsCameraReady(true);
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
          <Text
            style={[
              styles.message,
              {
                color: colors.text,
                fontFamily,
                fontSize: Math.round(16 * fontSizeMultiplier),
              },
            ]}
          >
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
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          onCameraReady={handleCameraReady}
        >
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
          <Text
            style={[
              styles.text,
              {
                color: colors.buttonText,
                fontFamily,
                fontSize: 24 * fontSizeMultiplier,
              },
            ]}
          >
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

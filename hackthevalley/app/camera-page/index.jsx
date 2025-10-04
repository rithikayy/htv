import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { ThemeContext } from "@/contexts/ThemeContext";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import io from "socket.io-client";

// Configuration
const BACKEND_URL = "ws://100.102.117.223:5000";
const FRAME_CAPTURE_INTERVAL = 30; // Capture every 30th frame
const CONNECTION_TIMEOUT = 5000; // 5 seconds

export default function CameraPage() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;
  const [facing, setFacing] = React.useState("back");
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [detectionCount, setDetectionCount] = useState(0);
  const [lastProcessedTime, setLastProcessedTime] = useState(null);

  const cameraRef = useRef(null);
  const frameCountRef = useRef(0);
  const isCapturingRef = useRef(false);
  const socketRef = useRef(null);
  const processingRef = useRef(false);

  // Initialize WebSocket connection
  useEffect(() => {
    console.log("Initializing WebSocket connection...");

    // Create socket connection
    socketRef.current = io(BACKEND_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: CONNECTION_TIMEOUT,
    });

    // Connection event handlers
    socketRef.current.on("connect", () => {
      console.log("✓ Connected to backend WebSocket");
      setIsConnected(true);
      setConnectionStatus("Connected");
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("✗ Disconnected from backend:", reason);
      setIsConnected(false);
      setConnectionStatus("Disconnected");
      setBoundingBoxes([]); // Clear boxes when disconnected
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
      setConnectionStatus(`Connection error: ${error.message}`);

      // Show alert on first connection failure
      if (!isConnected) {
        Alert.alert(
          "Connection Error",
          `Cannot connect to backend at ${BACKEND_URL}. Make sure:\n\n1. Backend is running (python app.py)\n2. IP address is correct\n3. Both devices are on same network`,
          [{ text: "OK" }]
        );
      }
    });

    socketRef.current.on("connection_status", (data) => {
      console.log("Connection status:", data);
      setConnectionStatus(data.message || "Connected");
    });

    // Detection result handler
    socketRef.current.on("detection_result", (data) => {
      console.log(`Received ${data.count} detections from backend`);

      if (data.success && data.detections) {
        setBoundingBoxes(data.detections);
        setDetectionCount(data.count);
        setLastProcessedTime(new Date().toLocaleTimeString());
      }

      processingRef.current = false; // Allow next frame to be processed
    });

    // Error handler
    socketRef.current.on("detection_error", (data) => {
      console.error("Detection error from backend:", data.error);
      processingRef.current = false; // Allow retry
    });

    // Cleanup on unmount
    return () => {
      console.log("Cleaning up WebSocket connection...");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Start/stop frame capture based on camera and connection status
  useEffect(() => {
    if (permission?.granted && isCameraReady && isConnected) {
      console.log("Starting frame capture (camera ready and connected)...");
      startFrameCapture();
    } else {
      console.log("Stopping frame capture...");
      isCapturingRef.current = false;
    }

    return () => {
      isCapturingRef.current = false;
    };
  }, [permission, isCameraReady, isConnected]);

  async function captureAndProcessFrame() {
    if (
      !cameraRef.current ||
      !isCapturingRef.current ||
      !socketRef.current ||
      !isConnected
    ) {
      return;
    }

    // Skip if still processing previous frame
    if (processingRef.current) {
      console.log("Skipping frame - still processing previous");
      return;
    }

    try {
      processingRef.current = true;
      console.log("Capturing frame for detection...");

      // Capture the frame
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, // Lower quality for faster processing
        skipProcessing: true,
        base64: true, // Get base64 directly
      });

      // Resize the image for faster transmission
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }], // Larger size for better detection
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      // Prepare payload
      const payload = {
        image: manipulatedImage.base64,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        timestamp: Date.now(),
        cameraFacing: facing,
      };

      // Send to backend via WebSocket
      console.log(
        `Sending frame to backend (${(
          manipulatedImage.base64.length / 1024
        ).toFixed(1)}KB)...`
      );
      socketRef.current.emit("process_frame", payload);
    } catch (error) {
      console.error("Error capturing/sending frame:", error);
      processingRef.current = false;
    }
  }

  function startFrameCapture() {
    isCapturingRef.current = true;
    captureFrames();
  }

  async function captureFrames() {
    while (isCapturingRef.current) {
      frameCountRef.current++;

      // Capture every Nth frame
      if (frameCountRef.current % FRAME_CAPTURE_INTERVAL === 0) {
        await captureAndProcessFrame();
      }

      // Wait for next frame (~60 FPS = ~16ms per frame)
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }

  function toggleFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
    // Clear detections when switching camera
    setBoundingBoxes([]);
  }

  function openSettings() {
    Linking.openSettings().catch((err) => {
      console.warn("Could not open settings:", err);
    });
  }

  function handleCameraReady() {
    console.log("Camera is ready!");
    setIsCameraReady(true);
  }

  // Render permission request screens
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
      {/* Status Bar */}
      <View
        style={[
          styles.statusBar,
          { backgroundColor: colors.background + "DD" },
        ]}
      >
        <View style={styles.statusRow}>
          <View
            style={[
              styles.connectionIndicator,
              { backgroundColor: isConnected ? "#00FF00" : "#FF0000" },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {connectionStatus}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: colors.text }]}>
          Objects: {detectionCount} | {lastProcessedTime || "Waiting..."}
        </Text>
      </View>

      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          onCameraReady={handleCameraReady}
        >
          {/* Render actual bounding boxes from backend */}
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
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>
                  {box.label}{" "}
                  {box.confidence ? `${Math.round(box.confidence * 100)}%` : ""}
                </Text>
              </View>
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
  statusBar: {
    position: "absolute",
    top: 40,
    left: 10,
    right: 10,
    zIndex: 100,
    padding: 10,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  connectionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

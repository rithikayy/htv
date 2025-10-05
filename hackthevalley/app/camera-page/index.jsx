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

// Configuration - FIXED: Use HTTP instead of WS
const BACKEND_URL = "http://100.102.213.124:5000";
const FRAME_CAPTURE_INTERVAL = 30;
const CONNECTION_TIMEOUT = 10000; // Increased to 10 seconds

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
  const [distanceEnabled, setDistanceEnabled] = useState(false);

  const cameraRef = useRef(null);
  const frameCountRef = useRef(0);
  const isCapturingRef = useRef(false);
  const socketRef = useRef(null);
  const processingRef = useRef(false);
  const connectionAttemptRef = useRef(0);

  // Initialize WebSocket connection
  useEffect(() => {
    console.log("Initializing WebSocket connection to:", BACKEND_URL);
    connectionAttemptRef.current += 1;

    // Create socket connection with improved configuration
    socketRef.current = io(BACKEND_URL, {
      transports: ["polling", "websocket"], // Try both transports
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      timeout: CONNECTION_TIMEOUT,
      autoConnect: true,
      forceNew: true,
    });

    // Connection event handlers
    socketRef.current.on("connect", () => {
      console.log("✓ Connected to backend WebSocket");
      console.log("Socket ID:", socketRef.current.id);
      setIsConnected(true);
      setConnectionStatus("Connected");
      connectionAttemptRef.current = 0;
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("✗ Disconnected from backend:", reason);
      setIsConnected(false);
      setConnectionStatus(`Disconnected: ${reason}`);
      setBoundingBoxes([]);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
      console.error("Error type:", error.type);
      console.error("Error description:", error.description);
      
      setConnectionStatus(`Error: ${error.message}`);
      setIsConnected(false);

      // Show alert only on first few attempts
      if (connectionAttemptRef.current <= 2) {
        Alert.alert(
          "Connection Error",
          `Cannot connect to backend at ${BACKEND_URL}\n\nChecklist:\n• Backend running? (python app.py)\n• IP correct? ${BACKEND_URL}\n• Same WiFi network?\n• Port 5000 open?\n• Check backend terminal for errors`,
          [
            { text: "Retry", onPress: () => socketRef.current?.connect() },
            { text: "Cancel", style: "cancel" }
          ]
        );
      }
    });

    socketRef.current.on("connect_timeout", () => {
      console.error("Connection timeout - server not responding");
      setConnectionStatus("Timeout - server not responding");
    });

    socketRef.current.on("reconnect_attempt", (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}...`);
      setConnectionStatus(`Reconnecting... (${attemptNumber})`);
    });

    socketRef.current.on("reconnect_failed", () => {
      console.error("Reconnection failed after all attempts");
      setConnectionStatus("Connection failed");
      Alert.alert(
        "Connection Failed",
        "Could not connect to backend after multiple attempts. Please check your network and backend server.",
        [{ text: "OK" }]
      );
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

        if (data.distanceEnabled) {
          setDistanceEnabled(true);
        }

        data.detections.forEach((det) => {
          if (det.distance_m !== null && det.distance_m !== undefined) {
            console.log(`${det.label}: ${det.distance_m}m away`);
          }
        });
      }

      processingRef.current = false;
    });

    // Error handler
    socketRef.current.on("detection_error", (data) => {
      console.error("Detection error from backend:", data.error);
      processingRef.current = false;
    });

    // Test connection with ping
    const pingInterval = setInterval(() => {
      if (socketRef.current?.connected) {
        console.log("Sending ping to keep connection alive");
        socketRef.current.emit("ping");
      }
    }, 30000); // Ping every 30 seconds

    socketRef.current.on("pong", (data) => {
      console.log("Received pong from server");
    });

    // Cleanup on unmount
    return () => {
      console.log("Cleaning up WebSocket connection...");
      clearInterval(pingInterval);
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
      console.log(`  Permission: ${permission?.granted}, Camera: ${isCameraReady}, Connected: ${isConnected}`);
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
      !socketRef.current?.connected
    ) {
      console.log("Skipping frame - preconditions not met");
      return;
    }

    if (processingRef.current) {
      return;
    }

    try {
      processingRef.current = true;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        base64: true,
      });

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const payload = {
        image: manipulatedImage.base64,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        timestamp: Date.now(),
        cameraFacing: facing,
      };

      console.log(
        `Sending frame (${(manipulatedImage.base64.length / 1024).toFixed(1)}KB)...`
      );
      
      socketRef.current.emit("process_frame", payload);

      // Set timeout to reset processing flag if no response
      setTimeout(() => {
        if (processingRef.current) {
          console.warn("Processing timeout - resetting flag");
          processingRef.current = false;
        }
      }, 5000);

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

      if (frameCountRef.current % FRAME_CAPTURE_INTERVAL === 0) {
        await captureAndProcessFrame();
      }

      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }

  function toggleFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
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

  function getBoxColor(distance) {
    if (distance === null || distance === undefined) {
      return "#808080";
    }
    if (distance < 1.0) return "#FF0000";
    if (distance < 2.0) return "#FFA500";
    if (distance < 3.0) return "#FFFF00";
    return "#00FF00";
  }

  function handleManualReconnect() {
    console.log("Manual reconnect requested");
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} />
    );
  }

  if (!permission.granted) {
    if (permission.canAskAgain) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Button onPress={requestPermission} title="Grant Permission" />
        </View>
      );
    } else {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text, fontFamily }]}>
            Camera permission was denied. To use the camera, go to Settings and
            allow camera access.
          </Text>
          <Button onPress={openSettings} title="Open Settings" />
        </View>
      );
    }
  }

  return (
    <View style={[styles.cameraContainer, { backgroundColor: colors.background }]}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: colors.background + "DD" }]}>
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
          {!isConnected && (
            <TouchableOpacity 
              onPress={handleManualReconnect}
              style={styles.reconnectButton}
            >
              <Text style={styles.reconnectText}>Reconnect</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.statusText, { color: colors.text }]}>
          Objects: {detectionCount} | {lastProcessedTime || "Waiting..."}
        </Text>
        {distanceEnabled && (
          <Text style={[styles.statusText, { color: colors.text }]}>
            📏 Distance Estimation: ON
          </Text>
        )}
      </View>

      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          onCameraReady={handleCameraReady}
        >
          {boundingBoxes.map((box, index) => {
            const boxColor = getBoxColor(box.distance_m);
            return (
              <View
                key={index}
                style={[
                  styles.boundingBox,
                  {
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                    borderColor: boxColor,
                  },
                ]}
              >
                <View style={[styles.labelContainer, { backgroundColor: boxColor }]}>
                  <Text style={styles.labelText}>
                    {box.label}
                    {box.distance_m !== null && box.distance_m !== undefined
                      ? ` (${box.distance_m}m)`
                      : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </CameraView>

        {/* Distance Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Distance:</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendColor, { backgroundColor: "#FF0000" }]} />
            <Text style={styles.legendText}>&lt; 1m</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendColor, { backgroundColor: "#FFA500" }]} />
            <Text style={styles.legendText}>1-2m</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendColor, { backgroundColor: "#FFFF00" }]} />
            <Text style={styles.legendText}>2-3m</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendColor, { backgroundColor: "#00FF00" }]} />
            <Text style={styles.legendText}>&gt; 3m</Text>
          </View>
        </View>
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
    backgroundColor: "transparent",
  },
  labelContainer: {
    position: "absolute",
    top: -20,
    left: 0,
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
  reconnectButton: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  reconnectText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  legendContainer: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 8,
    minWidth: 100,
  },
  legendTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 5,
  },
  legendText: {
    color: "#FFFFFF",
    fontSize: 11,
  },
});
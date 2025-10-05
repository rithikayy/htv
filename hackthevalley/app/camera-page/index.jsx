import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { ThemeContext } from "@/contexts/ThemeContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Audio } from "expo-av";
import io from "socket.io-client";

// Backend config
const BACKEND_URL = "http://100.102.213.124:5000";

export default function CameraPage() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;

  const [cameraPosition, setCameraPosition] = useState("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [detectionCount, setDetectionCount] = useState(0);
  const [lastProcessedTime, setLastProcessedTime] = useState(null);
  const [distanceEnabled, setDistanceEnabled] = useState(false);

  const cameraRef = useRef(null);
  const socketRef = useRef(null);
  const soundRef = useRef(null);
  const isProcessingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const intervalRef = useRef(null);
  const connectionAttemptRef = useRef(0);

  /** ---------------- SOCKET.IO SETUP ---------------- **/
  useEffect(() => {
    console.log("Connecting to backend:", BACKEND_URL);
    connectionAttemptRef.current += 1;

    socketRef.current = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
      forceNew: true,
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to backend, Socket ID:", socketRef.current.id);
      setIsConnected(true);
      setConnectionStatus("Connected");
      connectionAttemptRef.current = 0;
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setIsConnected(false);
      setConnectionStatus(`Disconnected: ${reason}`);
      setBoundingBoxes([]);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Connect error:", error.message);
      setConnectionStatus(`Error: ${error.message}`);
      setIsConnected(false);

      if (connectionAttemptRef.current <= 2) {
        Alert.alert(
          "Connection Error",
          `Cannot connect to backend at ${BACKEND_URL}\nCheck if backend is running, IP correct, same network, port open`,
          [
            { text: "Retry", onPress: () => socketRef.current?.connect() },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    });

    socketRef.current.on("reconnect_attempt", (attemptNumber) => {
      console.log("Reconnecting attempt", attemptNumber);
      setConnectionStatus(`Reconnecting... (${attemptNumber})`);
    });

    socketRef.current.on("reconnect_failed", () => {
      console.error("Reconnect failed after all attempts");
      setConnectionStatus("Connection failed");
      Alert.alert(
        "Connection Failed",
        "Could not connect to backend after multiple attempts. Please check your network and backend server.",
        [{ text: "OK" }]
      );
    });

    socketRef.current.on("detection_result", async (data) => {
      isProcessingRef.current = false;
      if (data.success && data.detections) {
        setDetectionCount(data.count);
        setLastProcessedTime(new Date().toLocaleTimeString());
        setBoundingBoxes(data.detections);
        if (data.distanceEnabled) setDistanceEnabled(true);

        // Play audio if provided
        if (data.audio) await playAudio(data.audio);
      }
    });

    socketRef.current.on("detection_error", (data) => {
      console.error("Detection error:", data.error);
      isProcessingRef.current = false;
    });

    const pingInterval = setInterval(() => {
      if (socketRef.current?.connected) socketRef.current.emit("ping");
    }, 30000);

    socketRef.current.on("pong", () => console.log("Received pong"));

    return () => {
      clearInterval(pingInterval);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  /** ---------------- AUDIO ---------------- **/
  async function playAudio(base64Audio) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64Audio}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  }

  /** ---------------- FRAME CAPTURE ---------------- **/
  useEffect(() => {
    if (permission?.granted && cameraRef.current && isConnected) {
      intervalRef.current = setInterval(captureFrame, 1000); // 1 fps stable
    }
    return () => clearInterval(intervalRef.current);
  }, [permission, isConnected]);

  async function captureFrame() {
    if (!cameraRef.current || isProcessingRef.current) return;

    const now = Date.now();
    if (now - lastFrameTimeRef.current < 1000) return;
    lastFrameTimeRef.current = now;
    isProcessingRef.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });

      if (photo.base64 && socketRef.current?.connected) {
        socketRef.current.emit("process_frame", {
          image: photo.base64,
          cameraFacing: cameraPosition,
        });
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
      isProcessingRef.current = false;
    }
  }

  /** ---------------- UI HELPERS ---------------- **/
  function toggleCamera() {
    setCameraPosition((c) => (c === "back" ? "front" : "back"));
    setBoundingBoxes([]);
  }

  function getBoxColor(distance) {
    if (distance === null || distance === undefined) return "#808080";
    if (distance < 1.0) return "#FF0000";
    if (distance < 2.0) return "#FFA500";
    if (distance < 3.0) return "#FFFF00";
    return "#00FF00";
  }

  function openSettings() {
    Linking.openSettings().catch((err) =>
      console.warn("Could not open settings:", err)
    );
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} />
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text, fontFamily }]}>
          Camera permission required
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={[styles.text, { color: colors.buttonText, fontFamily }]}>
            Grant Permission
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={openSettings}>
          <Text style={[styles.text, { color: colors.buttonText, fontFamily }]}>
            Open Settings
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /** ---------------- RENDER ---------------- **/
  return (
    <View style={[styles.cameraContainer, { backgroundColor: colors.background }]}>
      {/* Status */}
      <View style={styles.statusBar}>
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
        {distanceEnabled && (
          <Text style={[styles.statusText, { color: colors.text }]}>
            📏 Distance Estimation: ON
          </Text>
        )}
      </View>

      {/* Camera */}
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraPosition}
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
      </View>

      {/* Flip Camera */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={toggleCamera}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 10 },
  message: { textAlign: "center", paddingBottom: 10, fontSize: 16 },
  cameraContainer: { flex: 1, borderRadius: 8, padding: 10, justifyContent: "center" },
  cameraWrapper: { flex: 1, borderRadius: 8, overflow: "hidden", marginBottom: 30 },
  camera: { flex: 1 },
  buttonContainer: { position: "absolute", bottom: 64, flexDirection: "row", width: "100%", paddingHorizontal: 64 },
  button: { flex: 1, alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 12, borderRadius: 8 },
  text: { fontSize: 24, fontWeight: "bold" },
  boundingBox: { position: "absolute", borderWidth: 2, backgroundColor: "transparent" },
  labelContainer: { position: "absolute", top: -20, left: 0, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
  labelText: { color: "#000000", fontSize: 12, fontWeight: "bold" },
  statusBar: { position: "absolute", top: 40, left: 10, right: 10, zIndex: 100, padding: 10, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.5)" },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  connectionIndicator: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  legendContainer: { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", padding: 10, borderRadius: 8, minWidth: 100 },
  legendTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold", marginBottom: 5 },
  legendRow: { flexDirection: "row", alignItems: "center", marginVertical: 2 },
  legendColor: { width: 12, height: 12, borderRadius: 2, marginRight: 5 },
  legendText: { color: "#FFFFFF", fontSize: 11 },
});

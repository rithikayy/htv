import React, { useContext, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ThemeContext } from "@/contexts/ThemeContext";
import { Camera, useCameraDevice, useFrameProcessor } from "react-native-vision-camera";
import { Audio } from "expo-av";
import io from "socket.io-client";

export default function CameraPage() {
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;
  const [cameraPosition, setCameraPosition] = useState("back");
  const [hasPermission, setHasPermission] = useState(false);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const device = useCameraDevice(cameraPosition);
  const socketRef = useRef(null);
  const soundRef = useRef(null);
  const frameCountRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastProcessedTimeRef = useRef(0);

  // Request camera permission
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === "granted");
    })();
  }, []);

  // Setup audio and socket
  useEffect(() => {
    configureAudio();
    connectToServer();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  async function configureAudio() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error("Error configuring audio:", error);
    }
  }

  function connectToServer() {
    const SERVER_URL = "http://100.101.43.54:5001";
    
    socketRef.current = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    socketRef.current.on("detection_result", async (data) => {
      isProcessingRef.current = false;
      
      console.log("Received:", data.count, "objects");
      
      if (data.success && data.detections) {
        const boxes = data.detections.map((det) => ({
          x: det.box.x1 / data.image_size.width,
          y: det.box.y1 / data.image_size.height,
          width: (det.box.x2 - det.box.x1) / data.image_size.width,
          height: (det.box.y2 - det.box.y1) / data.image_size.height,
          label: det.label,
          confidence: det.confidence,
        }));
        
        setBoundingBoxes(boxes);
        
        if (data.audio) {
          await playAudio(data.audio);
        }
      }
    });

    socketRef.current.on("error", (error) => {
      console.error("Socket error:", error);
      isProcessingRef.current = false;
    });
  }

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

  // Frame processor - runs on separate thread
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    frameCountRef.current++;
    
    // Process every 60 frames (~1 second at 60fps)
    if (frameCountRef.current % 60 === 0) {
      const now = Date.now();
      
      // Rate limit: minimum 1 second between requests
      if (now - lastProcessedTimeRef.current < 1000) {
        return;
      }
      
      // Don't process if already processing
      if (isProcessingRef.current) {
        return;
      }
      
      lastProcessedTimeRef.current = now;
      isProcessingRef.current = true;
      
      // Convert frame to base64 and send
      // Note: This is a simplified version - you'll need to add the actual
      // frame conversion logic based on vision-camera's API
      processFrame(frame);
    }
  }, []);

  function processFrame(frame) {
    // This would need the actual vision-camera frame conversion
    // For now, you can use a plugin or native module to convert to base64
    // Or use react-native-vision-camera's built-in methods
    
    try {
      // Placeholder - replace with actual frame conversion
      // const base64 = convertFrameToBase64(frame);
      
      // socketRef.current?.emit("process_frame", {
      //   image: base64,
      // });
      
      console.log("Frame processed");
    } catch (error) {
      console.error("Error processing frame:", error);
      isProcessingRef.current = false;
    }
  }

  function toggleCamera() {
    setCameraPosition((current) => (current === "back" ? "front" : "back"));
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text, fontFamily }]}>
          Camera permission required
        </Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text, fontFamily }]}>
          Loading camera...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.cameraContainer, { backgroundColor: colors.background }]}>
      <View style={styles.statusIndicator}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isConnected ? "#00FF00" : "#FF0000" },
          ]}
        />
        <Text style={styles.statusText}>
          {isConnected ? "Connected" : "Disconnected"}
        </Text>
      </View>

      <View style={styles.cameraWrapper}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={true}
          frameProcessor={frameProcessor}
        >
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
                    {box.confidence ? `${Math.round(box.confidence * 100)}%` : ""}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </Camera>
      </View>

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
  statusIndicator: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
});
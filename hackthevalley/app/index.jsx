import React, { useContext } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { ThemeContext } from "../contexts/ThemeContext";
import { Stack, useRouter } from "expo-router";
import WaveBackground from "./WaveBackground.jsx";

const HomeScreen = () => {
  const router = useRouter();
  const { themeStyles } = useContext(ThemeContext);
  const { colors, fontFamily, fontSizeMultiplier } = themeStyles;

  return (
    <>
      <Stack.Screen 
        options={{
          headerStyle: { backgroundColor: colors.headerBackground || '#C8A882' },
          headerTintColor: colors.text,
          headerShown: true,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image 
                source={require('./assets/eyecaplogo.png')}
                style={{ width: 60, height: 60, marginRight: 15 }}
                resizeMode="contain"
              />
              <Text style={{ 
                color: colors.text,  // Use dynamic color
                fontSize: Math.round(20 * fontSizeMultiplier), 
                fontFamily: fontFamily 
              }}>
                Eye Eye, Captain!
              </Text>
            </View>
          ),
        }}
      />
      <WaveBackground>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => router.push("/camera-page")}
            style={[
              styles.button, 
              { 
                backgroundColor: colors.buttonBackground,  // Use dynamic color
                borderWidth: 3, 
                borderColor: colors.border || '#a58d6fff'  // Use dynamic color
              }
            ]}
          >
            <Image 
              source={require('./assets/camera-icon.png')} 
              style={{ width: 100, height: 100, tintColor: colors.text, marginBottom: 10 }}  // Use dynamic color
              resizeMode="contain"
            />
            <Text
              style={[
                styles.buttonText,
                {
                  color: colors.buttonText,  // Use dynamic color
                  fontFamily,
                  fontSize: Math.round(16 * fontSizeMultiplier),
                },
              ]}
            >
              Turn on camera
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            onPress={() => router.push("/settings-page")}
            style={[
              styles.settingsButton,
              { 
                backgroundColor: colors.buttonBackground,  // Use dynamic color
                borderWidth: 3, 
                borderColor: colors.border || '#a58d6fff'  // Use dynamic color
              },
            ]}
          >
            <Text
              style={[
                styles.settingsButtonText,
                {
                  color: colors.buttonText,  // Use dynamic color
                  fontFamily,
                  fontSize: Math.round(16 * fontSizeMultiplier),
                },
              ]}
            >
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </WaveBackground>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    paddingVertical: 30,
    paddingHorizontal: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    minHeight: 150,
  },
  buttonText: {
    fontSize: 20,
    textAlign: 'center',
  },
  bottomContainer: {
    padding: 20,
  },
  settingsButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "center",
  },
  settingsButtonText: {
    fontSize: 16,
  },
});

export default HomeScreen;
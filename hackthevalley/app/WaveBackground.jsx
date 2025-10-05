import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';

const WaveBackground = ({ children }) => {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('./assets/background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {children}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default WaveBackground;
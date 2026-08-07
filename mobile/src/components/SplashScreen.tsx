import React, { useEffect } from 'react';
import { Animated, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { styles } from '../constants/theme';

interface SplashScreenProps {
  visible: boolean;
  onFadeComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ visible, onFadeComplete }) => {
  const opacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFadeComplete();
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.splashContainer, styles.splashAbsolute, { opacity }]}>
      <StatusBar style="dark" />
      <Image
        source={require('../../assets/icon_app_trans.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

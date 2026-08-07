import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { styles } from '../constants/theme';

interface LockScreenProps {
  isUnlocked: boolean;
  onUnlock: () => void;
}

const DEMO_PIN = '1234';

export const LockScreen: React.FC<LockScreenProps> = ({ isUnlocked, onUnlock }) => {
  const lockOpacity = useRef(new Animated.Value(1)).current;
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handlePinPress = (digit: string) => {
    if (pinInput.length >= 4) return;
    const newPin = pinInput + digit;
    setPinInput(newPin);
    setPinError(false);

    if (newPin.length === 4) {
      if (newPin === DEMO_PIN) {
        setPinVerified(true);
        setTimeout(() => {
          Animated.timing(lockOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => {
            onUnlock();
            setPinInput('');
          });
        }, 150);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 600);
      }
    }
  };

  const handlePinDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  return (
    <Animated.View style={[styles.lockContainerAbsolute, { opacity: lockOpacity }]}>
      <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="dark" />

        <Image
          source={require('../../assets/icon_app_trans.png')}
          style={styles.lockLogo}
          resizeMode="contain"
        />

        <Text style={styles.lockTitle}>Masukkan PIN</Text>
        <Text style={styles.lockSubtitle}>Masukkan 4 digit PIN untuk melanjutkan</Text>

        <View style={styles.lockDotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.lockDot,
                pinInput.length > i ? styles.lockDotFilled : styles.lockDotEmpty,
                pinError ? styles.lockDotError : null,
              ]}
            />
          ))}
        </View>

        {pinError && <Text style={styles.lockErrorText}>PIN salah, coba lagi</Text>}

        <View style={styles.lockKeypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, idx) => {
            if (key === '') {
              return <View key={idx} style={styles.lockKeyEmpty} />;
            }
            if (key === 'del') {
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.lockKey}
                  onPress={handlePinDelete}
                  activeOpacity={0.6}
                >
                  <Image
                    source={require('../../assets/lockscreen/delete_icon.png')}
                    style={styles.lockKeyDelIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={idx}
                style={styles.lockKey}
                onPress={() => handlePinPress(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.lockKeyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.lockBiometric} activeOpacity={0.7}>
          <Text style={styles.lockBiometricText}>Gunakan Biometrik</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
};

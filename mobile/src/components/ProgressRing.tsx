import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { styles } from '../constants/theme';

interface ProgressRingProps {
  percentage: number;
  label: string;
  day: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ percentage, label, day }) => {
  let borderStyle = {};

  if (percentage === 100) {
    borderStyle = { borderColor: '#4C307A' };
  } else if (percentage === 80) {
    borderStyle = {
      borderColor: '#E2D9F3',
      borderTopColor: '#4C307A',
      borderLeftColor: '#4C307A',
      borderRightColor: '#4C307A',
    };
  } else if (percentage === 50) {
    borderStyle = {
      borderColor: '#E2D9F3',
      borderTopColor: '#4C307A',
      borderRightColor: '#4C307A',
    };
  } else if (percentage === 30) {
    borderStyle = {
      borderColor: '#E2D9F3',
      borderTopColor: '#4C307A',
    };
  } else if (percentage === 10) {
    borderStyle = {
      borderColor: '#E2D9F3',
      borderTopColor: '#4C307A',
      transform: [{ rotate: '45deg' }],
    };
  } else {
    borderStyle = { borderColor: '#E2D9F3' };
  }

  return (
    <View style={ringStyles.ringWrapper}>
      <Text style={styles.ringDayText}>{day}</Text>
      <View style={[styles.ringOuter, borderStyle]}>
        <View style={styles.ringInner} />
      </View>
      <Text style={styles.ringPercentText}>{label}</Text>
    </View>
  );
};

const ringStyles = StyleSheet.create({
  ringWrapper: {
    alignItems: 'center',
  },
});

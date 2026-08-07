import React from 'react';
import { View, Text, Image } from 'react-native';
import { styles } from '../constants/theme';

interface MetricCardProps {
  icon: any;
  label: string;
  value: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value }) => {
  return (
    <View style={styles.gridCard}>
      <Image source={icon} style={styles.gridIconImg} />
      <Text style={styles.gridCardLabel}>{label}</Text>
      <Text style={styles.gridCardValue}>{value}</Text>
    </View>
  );
};

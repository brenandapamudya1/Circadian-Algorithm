import React from 'react';
import { View, Text, Image } from 'react-native';
import { styles } from '../constants/theme';

interface AlertPanelProps {
  state: 'anomaly' | 'gated' | 'normal' | 'disconnected';
  windowName?: string;
  suppressedReason?: string;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ state, windowName, suppressedReason }) => {
  if (state === 'anomaly') {
    return (
      <View style={[styles.alertCard, styles.alertCardAnomaly]}>
        <View style={styles.alertIconContainer}>
          <Image source={require('../../assets/ICON_HOMEPAGE/warning_icon.png')} style={styles.alertIconImg} />
        </View>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, styles.alertTitleAnomaly]}>Anomali Terdeteksi</Text>
          <Text style={[styles.alertDesc, styles.alertDescAnomaly]}>
            Fluktuasi abnormal di window {windowName} teridentifikasi sebagai anomali valid.
          </Text>
        </View>
      </View>
    );
  }

  if (state === 'gated') {
    return (
      <View style={[styles.alertCard, styles.alertCardGated]}>
        <View style={styles.alertIconContainer}>
          <Image
            source={require('../../assets/ICON_HOMEPAGE/warning_icon.png')}
            style={[styles.alertIconImg, { tintColor: '#0288D1' }]}
          />
        </View>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, styles.alertTitleGated]}>
            Gating Aktif ({suppressedReason})
          </Text>
          <Text style={[styles.alertDesc, styles.alertDescGated]}>
            Anomali disaring oleh aturan sirkadian biologis. Kondisi dinilai stabil.
          </Text>
        </View>
      </View>
    );
  }

  if (state === 'normal') {
    return (
      <View style={[styles.alertCard, styles.alertCardNormal]}>
        <View style={styles.alertIconContainer}>
          <Text style={{ fontSize: 20 }}>✓</Text>
        </View>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, styles.alertTitleNormal]}>Semua Sistem Normal</Text>
          <Text style={[styles.alertDesc, styles.alertDescNormal]}>
            Parameter HRV, Vokal, dan Motorik Anda stabil di window {windowName}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.alertCard}>
      <View style={styles.alertIconContainer}>
        <Image source={require('../../assets/ICON_HOMEPAGE/warning_icon.png')} style={styles.alertIconImg} />
      </View>
      <View style={styles.alertTextContainer}>
        <Text style={styles.alertTitle}>Gelang Belum Terhubung</Text>
        <Text style={styles.alertDesc}>
          Hubungkan gelang Bipolyzer Anda di tab Pengaturan untuk memulai pemantauan sirkadian.
        </Text>
      </View>
    </View>
  );
};

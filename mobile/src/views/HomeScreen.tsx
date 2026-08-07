import React from 'react';
import { View, Text } from 'react-native';
import { PipelineResult } from '../circadian/pipeline';
import { ConnectionState } from '../services/bleManager';
import { MetricCard } from '../components/MetricCard';
import { AlertPanel } from '../components/AlertPanel';
import { ProgressRing } from '../components/ProgressRing';
import { styles } from '../constants/theme';

interface HomeScreenProps {
  latestResult: PipelineResult | null;
  bleConnectionState: ConnectionState;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ latestResult, bleConnectionState }) => {
  const getAlertState = (): 'anomaly' | 'gated' | 'normal' | 'disconnected' => {
    if (!latestResult) return 'disconnected';
    if (!latestResult.circadian_valid) return 'anomaly';
    if (latestResult.suppressed_reason) return 'gated';
    return 'normal';
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Selamat pagi, User!</Text>
        <Text style={styles.headerSubtitle}>Bagaimana hari ini?</Text>
      </View>

      <View style={styles.content}>
        <View style={[
          styles.phaseCard,
          latestResult && !latestResult.circadian_valid && styles.phaseCardAlert,
        ]}>
          <View style={styles.phaseCardLeft}>
            <Text style={styles.phaseCardLabel}>FASE SAAT INI</Text>
            <Text style={[
              styles.phaseCardValue,
              latestResult && !latestResult.circadian_valid && styles.phaseCardValueAlert,
            ]}>
              {latestResult
                ? (latestResult.circadian_valid ? 'Stabil' : 'Potensi Relaps')
                : 'Stabil'}
            </Text>
          </View>
          <View style={styles.phaseCardRight}>
            <Text style={styles.phaseCardDurationLabel}>
              {latestResult ? 'Window' : 'Berlangsung'}
            </Text>
            <Text style={[
              styles.phaseCardDurationValue,
              latestResult && !latestResult.circadian_valid && styles.phaseCardDurationValueAlert,
            ]}>
              {latestResult ? latestResult.window_name : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <MetricCard
            icon={require('../../assets/ICON_HOMEPAGE/heart_icon.png')}
            label="HRV (RMSSD)"
            value={latestResult ? `${latestResult.hrv_rmssd.toFixed(0)} ms` : '—'}
          />
          <MetricCard
            icon={require('../../assets/ICON_HOMEPAGE/mic_icon.png')}
            label="Biomarker Vokal"
            value={latestResult ? `${latestResult.vocal_f0.toFixed(0)}` : '—'}
          />
          <MetricCard
            icon={require('../../assets/ICON_HOMEPAGE/moon_icon.png')}
            label="Dwell Time"
            value={latestResult ? `${latestResult.imu_dwell_min.toFixed(1)} m` : '—'}
          />
          <MetricCard
            icon={require('../../assets/ICON_HOMEPAGE/walking_icon.png')}
            label="Status Alat"
            value={bleConnectionState === 'connected' ? 'Terhubung' : 'Terputus'}
          />
        </View>

        <AlertPanel
          state={getAlertState()}
          windowName={latestResult?.window_name}
          suppressedReason={latestResult?.suppressed_reason ?? undefined}
        />

        <View style={styles.progressSection}>
          <Text style={styles.progressTitle}>Progress Pengisian Mood Tracker Minggu Ini</Text>
          <View style={styles.ringsContainer}>
            <ProgressRing day="M" percentage={0} label="0%" />
            <ProgressRing day="S" percentage={0} label="0%" />
            <ProgressRing day="S" percentage={0} label="0%" />
            <ProgressRing day="R" percentage={0} label="0%" />
            <ProgressRing day="K" percentage={0} label="0%" />
            <ProgressRing day="J" percentage={0} label="0%" />
            <ProgressRing day="S" percentage={0} label="0%" />
          </View>
        </View>
      </View>
    </View>
  );
};

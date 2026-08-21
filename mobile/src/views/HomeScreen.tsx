import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PipelineResult } from '../circadian/pipeline';
import { ConnectionState } from '../services/bleManager';
import { MetricCard } from '../components/MetricCard';
import { AlertPanel } from '../components/AlertPanel';
import { DailyReminderCard } from '../components/DailyReminderCard';
import { StreakCounter, BadgeGrid } from '../components/GamificationBadge';
import {
  getGamificationState,
  checkAndUnlockBadges,
  updateStreak,
  GamificationState,
  BADGES,
} from '../services/gamificationService';
import { getUsername } from '../database/queries';
import { styles } from '../constants/theme';

interface HomeScreenProps {
  latestResult: PipelineResult | null;
  bleConnectionState: ConnectionState;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ latestResult, bleConnectionState, onOpenSettings }) => {
  const [gamification, setGamification] = useState<GamificationState | null>(null);
  const [username, setUsername] = useState('User');

  useEffect(() => {
    loadGamificationData();
  }, []);

  useEffect(() => {
    if (bleConnectionState === 'connected') {
      updateStreak();
      checkAndUnlockBadges().then((newBadges) => {
        if (newBadges.length > 0) {
          loadGamificationData();
        }
      });
    }
  }, [bleConnectionState]);

  const loadGamificationData = async () => {
    try {
      const state = await getGamificationState();
      setGamification(state);
      const name = await getUsername();
      setUsername(name);
    } catch (err) {
      console.warn('Gagal memuat data gamifikasi:', err);
    }
  };

  const getAlertState = (): 'anomaly' | 'gated' | 'normal' | 'disconnected' => {
    if (!latestResult) return 'disconnected';
    if (!latestResult.circadian_valid) return 'anomaly';
    if (latestResult.suppressed_reason) return 'gated';
    return 'normal';
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 17) return 'Selamat siang';
    if (hour < 21) return 'Selamat sore';
    return 'Selamat malam';
  };

  return (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{getGreeting()}, {username}!</Text>
          <Text style={styles.headerSubtitle}>Bagaimana hari ini?</Text>
        </View>
        <TouchableOpacity style={styles.headerSettingsBtn} onPress={onOpenSettings}>
          <Text style={styles.headerSettingsIcon}>⚙</Text>
        </TouchableOpacity>
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

        {gamification && (
          <StreakCounter streak={gamification.streakDays} />
        )}

        <DailyReminderCard onOpenSettings={onOpenSettings} />

        {gamification && (
          <View style={styles.badgeSection}>
            <Text style={styles.badgeSectionTitle}>Pencapaian</Text>
            <BadgeGrid
              badges={BADGES}
              unlockedIds={gamification.badgesUnlocked}
            />
          </View>
        )}
      </View>
    </View>
  );
};

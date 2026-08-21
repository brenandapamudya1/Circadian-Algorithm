import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TrendChart } from '../components/TrendChart';
import { StreakCounter, BadgeGrid } from '../components/GamificationBadge';
import {
  getGamificationState,
  checkAndUnlockBadges,
  updateStreak,
  GamificationState,
  BADGES,
} from '../services/gamificationService';
import { DbFeatureVector } from '../database/queries';
import { styles } from '../constants/theme';

interface TrenScreenProps {
  historicalVectors: DbFeatureVector[];
}

type TrendFilter = 'Mingguan' | 'Bulanan';

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const WEEK_LABELS = ['M1', 'M2', 'M3', 'M4'];

const EmptyChartState: React.FC<{ message: string }> = ({ message }) => (
  <View style={emptyChart.container}>
    <Text style={emptyChart.text}>{message}</Text>
  </View>
);

function classifyPhase(fv: DbFeatureVector): number {
  if (fv.circadian_valid === 1) return 2;
  if (fv.suppressed_reason) return 1;
  const vocalZ = fv.vocal_zscore ?? 0;
  const imuZ = fv.imu_zscore ?? 0;
  if (vocalZ > 1.5 && imuZ > 1.0) return 1;
  if (vocalZ < -1.0 && imuZ < -0.5) return 1;
  return 0;
}

function aggregatePhaseByDay(vectors: DbFeatureVector[]): { values: (number | null)[]; labels: string[]; hasData: boolean; colors: string[] } {
  if (vectors.length === 0) return { values: [null, null, null, null, null, null, null], labels: DAY_LABELS, hasData: false, colors: [] };

  const dailyMap = new Map<string, number[]>();

  for (const v of vectors) {
    const day = v.timestamp.split('T')[0];
    if (!dailyMap.has(day)) dailyMap.set(day, []);
    dailyMap.get(day)!.push(classifyPhase(v));
  }

  const now = new Date();
  const dayNames: string[] = [];
  const values: (number | null)[] = [];
  const colors: string[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayIdx = (d.getDay() + 6) % 7;
    dayNames.push(DAY_LABELS[dayIdx]);

    if (dailyMap.has(dateStr)) {
      const dayValues = dailyMap.get(dateStr)!;
      const avg = dayValues.length > 0 ? dayValues.reduce((a, b) => a + b, 0) / dayValues.length : 0;
      values.push(avg);
      if (avg >= 1.5) colors.push('#388E3C');
      else if (avg >= 0.5) colors.push('#E8A838');
      else colors.push('#E06060');
    } else {
      values.push(null);
      colors.push('#A88AD3');
    }
  }

  return { values, labels: dayNames, hasData: values.some(v => v !== null), colors };
}

function aggregatePhaseByWeek(vectors: DbFeatureVector[]): { values: (number | null)[]; labels: string[]; hasData: boolean; colors: string[] } {
  if (vectors.length === 0) return { values: [null, null, null, null], labels: WEEK_LABELS, hasData: false, colors: [] };

  const now = new Date();
  const weeklyBuckets: number[][] = [[], [], [], []];

  for (const v of vectors) {
    const date = new Date(v.timestamp);
    const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    let weekIdx: number;
    if (daysAgo <= 7) weekIdx = 3;
    else if (daysAgo <= 14) weekIdx = 2;
    else if (daysAgo <= 21) weekIdx = 1;
    else if (daysAgo <= 28) weekIdx = 0;
    else continue;

    weeklyBuckets[weekIdx].push(classifyPhase(v));
  }

  const values = weeklyBuckets.map(bucket =>
    bucket.length > 0 ? bucket.reduce((a, b) => a + b, 0) / bucket.length : null
  );

  const colors = values.map(v => {
    if (v === null) return '#A88AD3';
    if (v >= 1.5) return '#388E3C';
    if (v >= 0.5) return '#E8A838';
    return '#E06060';
  });

  return { values, labels: WEEK_LABELS, hasData: values.some(v => v !== null), colors };
}

export const TrenScreen: React.FC<TrenScreenProps> = ({ historicalVectors }) => {
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('Mingguan');
  const [gamification, setGamification] = useState<GamificationState | null>(null);

  useEffect(() => {
    loadGamification();
  }, []);

  const loadGamification = async () => {
    try {
      const state = await getGamificationState();
      setGamification(state);
      await updateStreak();
      await checkAndUnlockBadges();
      const updated = await getGamificationState();
      setGamification(updated);
    } catch (err) {
      console.warn('Gagal memuat gamifikasi:', err);
    }
  };

  const isWeekly = trendFilter === 'Bulanan';
  const aggregate = isWeekly ? aggregatePhaseByWeek : aggregatePhaseByDay;

  const phase = useMemo(() => aggregate(historicalVectors), [historicalVectors, isWeekly]);

  const stableDays = new Set(
    historicalVectors.filter(v => v.circadian_valid === 1).map(v => v.timestamp.split('T')[0])
  ).size;

  const totalDays = new Set(
    historicalVectors.map(v => v.timestamp.split('T')[0])
  ).size;

  const getAccentColor = () => {
    const validVals = phase.values.filter((v): v is number => v !== null);
    if (validVals.length === 0) return '#388E3C';
    const avg = validVals.reduce((a, b) => a + b, 0) / validVals.length;
    if (avg >= 1.5) return '#388E3C';
    if (avg >= 0.5) return '#E8A838';
    return '#E06060';
  };

  return (
    <View style={styles.trenContainer}>
      <View style={styles.trenHeader}>
        <Text style={styles.trenHeaderTitle}>Tren Fase</Text>
        <Text style={styles.trenHeaderSubtitle}>
          {isWeekly ? '4 Minggu Terakhir' : '7 Hari Terakhir'}
        </Text>
      </View>

      <View style={styles.segmentedControl}>
        {(['Mingguan', 'Bulanan'] as TrendFilter[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.segmentBtn, trendFilter === filter && styles.segmentBtnActive]}
            onPress={() => setTrendFilter(filter)}
          >
            <Text style={[styles.segmentText, trendFilter === filter ? styles.segmentTextActive : styles.segmentTextInactive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartCardHeader}>
          <Text style={styles.chartCardTitle}>FASE STABIL</Text>
        </View>
        {phase.hasData ? (
          <TrendChart
            values={phase.values}
            labels={phase.labels}
            maxY={2}
            gridValues={[0, 1, 2]}
            formatYLabel={(v) => (v === 2 ? '2' : v === 1 ? '1' : '0')}
            showTooltip={false}
            accentColor={getAccentColor()}
          />
        ) : (
          <EmptyChartState message="Hubungkan gelang untuk melihat tren fase" />
        )}
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#388E3C' }]} />
          <Text style={styles.legendText}>Stabil</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E8A838' }]} />
          <Text style={styles.legendText}>Manik</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E06060' }]} />
          <Text style={styles.legendText}>Depresi</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Hari Stabil</Text>
          <Text style={styles.statValue}>
            {stableDays > 0 ? stableDays : '—'} <Text style={styles.statUnit}>{stableDays > 0 ? 'hari' : ''}</Text>
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Hari</Text>
          <Text style={styles.statValue}>
            {totalDays > 0 ? totalDays : '—'} <Text style={styles.statUnit}>{totalDays > 0 ? 'hari' : ''}</Text>
          </Text>
        </View>
      </View>

      {gamification && (
        <StreakCounter streak={gamification.streakDays} />
      )}

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
  );
};

const emptyChart = {
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 40,
  },
  text: {
    fontSize: 13,
    color: '#8A7B9C',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
};

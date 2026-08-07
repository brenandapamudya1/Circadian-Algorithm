import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { TrendChart } from '../components/TrendChart';
import { DbFeatureVector } from '../database/queries';
import { styles } from '../constants/theme';

interface TrenScreenProps {
  historicalVectors: DbFeatureVector[];
}

type TrendFilter = 'Semua' | 'Minggu Ini' | 'Bulan Ini';

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const WEEK_LABELS = ['M1', 'M2', 'M3', 'M4'];

const SUBTITLE_MAP: Record<TrendFilter, string> = {
  'Semua': 'Semua Data Tersedia',
  'Minggu Ini': '7 Hari Terakhir',
  'Bulan Ini': '4 Minggu Terakhir',
};

const EmptyChartState: React.FC<{ message: string }> = ({ message }) => (
  <View style={emptyChart.container}>
    <Text style={emptyChart.icon}>📊</Text>
    <Text style={emptyChart.text}>{message}</Text>
  </View>
);

function filterByRange(vectors: DbFeatureVector[], days: number): DbFeatureVector[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();
  return vectors.filter(v => v.timestamp >= cutoffIso);
}

function aggregateByDay(vectors: DbFeatureVector[], field: 'hrv_rmssd' | 'vocal_f0'): { values: number[]; labels: string[]; hasData: boolean } {
  if (vectors.length === 0) return { values: [0, 0, 0, 0, 0, 0, 0], labels: DAY_LABELS, hasData: false };

  const dailyMap = new Map<string, number[]>();

  for (const v of vectors) {
    const day = v.timestamp.split('T')[0];
    if (!dailyMap.has(day)) dailyMap.set(day, []);
    dailyMap.get(day)!.push(v[field] ?? 0);
  }

  const sortedDays = Array.from(dailyMap.keys()).sort().slice(-7);

  const dayNames: string[] = [];
  const values: number[] = [];

  for (const day of sortedDays) {
    const date = new Date(day + 'T00:00:00');
    const dayIdx = (date.getDay() + 6) % 7;
    dayNames.push(DAY_LABELS[dayIdx]);
    const dayValues = dailyMap.get(day) || [];
    const avg = dayValues.length > 0 ? dayValues.reduce((a, b) => a + b, 0) / dayValues.length : 0;
    values.push(avg);
  }

  while (dayNames.length < 7) {
    dayNames.unshift('');
    values.unshift(0);
  }

  return { values, labels: dayNames, hasData: values.some(v => v > 0) };
}

function aggregateByWeek(vectors: DbFeatureVector[], field: 'hrv_rmssd' | 'vocal_f0'): { values: number[]; labels: string[]; hasData: boolean } {
  if (vectors.length === 0) return { values: [0, 0, 0, 0], labels: WEEK_LABELS, hasData: false };

  const now = new Date();
  const weeklyBuckets: number[][] = [[], [], [], []];

  for (const v of vectors) {
    const date = new Date(v.timestamp);
    const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    let weekIdx: number;
    if (daysAgo <= 7) weekIdx = 3;
    else if (daysAgo <= 14) weekIdx = 2;
    else if (daysAgo <= 21) weekIdx = 1;
    else weekIdx = 0;

    weeklyBuckets[weekIdx].push(v[field] ?? 0);
  }

  const values = weeklyBuckets.map(bucket =>
    bucket.length > 0 ? bucket.reduce((a, b) => a + b, 0) / bucket.length : 0
  );

  return { values, labels: WEEK_LABELS, hasData: values.some(v => v > 0) };
}

export const TrenScreen: React.FC<TrenScreenProps> = ({ historicalVectors }) => {
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('Semua');

  const filteredVectors = useMemo(() => {
    switch (trendFilter) {
      case 'Minggu Ini':
        return filterByRange(historicalVectors, 7);
      case 'Bulan Ini':
        return filterByRange(historicalVectors, 30);
      default:
        return historicalVectors;
    }
  }, [historicalVectors, trendFilter]);

  const isWeekly = trendFilter === 'Bulan Ini';
  const aggregate = isWeekly ? aggregateByWeek : aggregateByDay;

  const hrv = useMemo(() => aggregate(filteredVectors, 'hrv_rmssd'), [filteredVectors, isWeekly]);
  const vocal = useMemo(() => aggregate(filteredVectors, 'vocal_f0'), [filteredVectors, isWeekly]);

  const avgHrv = hrv.hasData
    ? Math.round(hrv.values.filter(v => v > 0).reduce((a, b) => a + b, 0) / hrv.values.filter(v => v > 0).length)
    : 0;

  const stableDays = new Set(
    filteredVectors.filter(v => v.circadian_valid === 1).map(v => v.timestamp.split('T')[0])
  ).size;

  return (
    <View style={styles.trenContainer}>
      <View style={styles.trenHeader}>
        <Text style={styles.trenHeaderTitle}>Tren Hari Ini</Text>
        <Text style={styles.trenHeaderSubtitle}>{SUBTITLE_MAP[trendFilter]}</Text>
      </View>

      <View style={styles.segmentedControl}>
        {(['Semua', 'Minggu Ini', 'Bulan Ini'] as TrendFilter[]).map((filter) => (
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
          <Image
            source={require('../../assets/ICON_HOMEPAGE/graph_icon.png')}
            style={styles.chartCardIconImg}
          />
          <Text style={styles.chartCardTitle}>HRV HARIAN (MS)</Text>
        </View>
        {hrv.hasData ? (
          <TrendChart
            values={hrv.values}
            labels={hrv.labels}
            maxY={75}
            showTooltip={avgHrv > 0}
            tooltipIndex={Math.floor(hrv.values.length / 2)}
            tooltipText={`Average ${avgHrv} ms`}
            accentColor="#A88AD3"
          />
        ) : (
          <EmptyChartState message="Hubungkan gelang untuk melihat data HRV" />
        )}
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartCardHeader}>
          <Image
            source={require('../../assets/ICON_HOMEPAGE/graph_icon.png')}
            style={styles.chartCardIconImg}
          />
          <Text style={styles.chartCardTitle}>BIOMARKER VOKAL</Text>
        </View>
        {vocal.hasData ? (
          <TrendChart
            values={vocal.values}
            labels={vocal.labels}
            maxY={300}
            showTooltip={false}
            accentColor="#4C307A"
          />
        ) : (
          <EmptyChartState message="Hubungkan gelang untuk melihat data vokal" />
        )}
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Rata-Rata HRV</Text>
          <Text style={styles.statValue}>
            {avgHrv > 0 ? avgHrv : '—'} <Text style={styles.statUnit}>{avgHrv > 0 ? 'ms' : ''}</Text>
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Fase Stabil</Text>
          <Text style={styles.statValue}>
            {stableDays > 0 ? stableDays : '—'} <Text style={styles.statUnit}>{stableDays > 0 ? 'hari' : ''}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const emptyChart = {
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 40,
  },
  icon: {
    fontSize: 32,
    marginBottom: 12,
    opacity: 0.5,
  },
  text: {
    fontSize: 13,
    color: '#8A7B9C',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
};

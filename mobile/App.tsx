import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import Svg, { Path, Circle, Line, G, Rect, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

// --- PROGRESS RING COMPONENT FOR BERANDA ---
interface ProgressRingProps {
  percentage: number;
  label: string;
  day: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({ percentage, label, day }) => {
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
    <View style={styles.ringWrapper}>
      <Text style={styles.ringDayText}>{day}</Text>
      <View style={[styles.ringOuter, borderStyle]}>
        <View style={styles.ringInner} />
      </View>
      <Text style={styles.ringPercentText}>{label}</Text>
    </View>
  );
};

// --- CUSTOM SMOOTH LINE CHART COMPONENT FOR TREN ---
interface ChartProps {
  values: number[]; // 7 values for 7 days (Mon-Sun)
  maxY: number;
  showTooltip?: boolean;
  tooltipIndex?: number;
  tooltipText?: string;
  accentColor?: string;
}

const TrendChart: React.FC<ChartProps> = ({
  values,
  maxY,
  showTooltip = false,
  tooltipIndex = 3,
  tooltipText = 'Average 50 ms',
  accentColor = '#A88AD3',
}) => {
  const chartHeight = 110;
  const paddingX = 40;
  const chartWidth = width - 40 - paddingX - 20; // grid offsets

  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  // Calculate point coordinates
  const points = values.map((val, idx) => {
    const x = paddingX + (idx * (chartWidth / 6));
    const y = chartHeight - (val / maxY) * chartHeight;
    return { x, y };
  });

  // Generate smooth cubic bezier path
  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const linePath = getSmoothPath(points);

  // Y-axis grid lines at 0, 25, 50, 75 (mapped values)
  const gridValues = [0, 25, 50, 75];

  return (
    <View style={styles.chartWrapper}>
      <Svg height={chartHeight + 40} width={width - 80}>
        {/* Horizontal grid lines & Y labels */}
        {gridValues.map((gridVal) => {
          const yPos = chartHeight - (gridVal / maxY) * chartHeight;
          return (
            <G key={gridVal}>
              <Line
                x1={paddingX}
                y1={yPos}
                x2={paddingX + chartWidth}
                y2={yPos}
                stroke="#F2EDF7"
                strokeWidth="1"
              />
              <SvgText
                x={15}
                y={yPos + 4}
                fill="#8A7B9C"
                fontSize="11"
                textAnchor="middle"
              >
                {gridVal}
              </SvgText>
            </G>
          );
        })}

        {/* Vertical grid lines at each day */}
        {days.map((_, idx) => {
          const xPos = paddingX + (idx * (chartWidth / 6));
          return (
            <Line
              key={idx}
              x1={xPos}
              y1={0}
              x2={xPos}
              y2={chartHeight}
              stroke="#F8F6FA"
              strokeWidth="1"
            />
          );
        })}

        {/* Outer Glow Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={`${accentColor}30`} // 30 is hex for transparency
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Core Trend Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Tooltip & Pointer dot */}
        {showTooltip && (
          <G>
            {/* Draw tooltip box */}
            <Rect
              x={points[tooltipIndex].x - 55}
              y={points[tooltipIndex].y - 35}
              width={110}
              height={22}
              rx={6}
              fill="#2E1E43"
            />
            <SvgText
              x={points[tooltipIndex].x}
              y={points[tooltipIndex].y - 20}
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {tooltipText}
            </SvgText>
            {/* Tooltip pointer dot on the line */}
            <Circle
              cx={points[tooltipIndex].x}
              cy={points[tooltipIndex].y}
              r={6}
              fill={accentColor}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </G>
        )}

        {/* X labels (Days) */}
        {days.map((day, idx) => {
          const xPos = paddingX + (idx * (chartWidth / 6));
          return (
            <SvgText
              key={day}
              x={xPos}
              y={chartHeight + 22}
              fill="#2E1E43"
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
            >
              {day}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'Beranda' | 'Tren' | 'Pengaturan' | 'Riwayat'>('Beranda');
  const [trendFilter, setTrendFilter] = useState<'Semua' | 'Minggu Ini' | 'Bulan Ini'>('Semua');
  const [notifFaseOn, setNotifFaseOn] = useState<boolean>(true);
  const [notifHarianOn, setNotifHarianOn] = useState<boolean>(false);

  return (
    <SafeAreaView style={[
      styles.container,
      activeTab === 'Tren' ? styles.bgTren
        : activeTab === 'Pengaturan' ? styles.bgPengaturan
          : activeTab === 'Riwayat' ? styles.bgRiwayat
            : styles.bgBeranda
    ]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* ==================== TAB: BERANDA ==================== */}
        {activeTab === 'Beranda' && (
          <View>
            {/* Header Section */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Selamat pagi, User!</Text>
              <Text style={styles.headerSubtitle}>Bagaimana hari ini?</Text>
            </View>

            {/* Content Area */}
            <View style={styles.content}>
              {/* FASE SAAT INI Card */}
              <View style={styles.phaseCard}>
                <View style={styles.phaseCardLeft}>
                  <Text style={styles.phaseCardLabel}>FASE SAAT INI</Text>
                  <Text style={styles.phaseCardValue}>Stabil</Text>
                </View>
                <View style={styles.phaseCardRight}>
                  <Text style={styles.phaseCardDurationLabel}>Berlangsung</Text>
                  <Text style={styles.phaseCardDurationValue}>18 jam</Text>
                </View>
              </View>

              {/* Grid Metrics */}
              <View style={styles.grid}>
                <View style={styles.gridCard}>
                  <Image source={require('./assets/ICON_HOMEPAGE/heart_icon.png')} style={styles.gridIconImg} />
                  <Text style={styles.gridCardLabel}>HRV</Text>
                  <Text style={styles.gridCardValue}>54 ms</Text>
                </View>

                <View style={styles.gridCard}>
                  <Image source={require('./assets/ICON_HOMEPAGE/mic_icon.png')} style={styles.gridIconImg} />
                  <Text style={styles.gridCardLabel}>Biomarker vokal</Text>
                  <Text style={styles.gridCardValue}>0.74</Text>
                </View>

                <View style={styles.gridCard}>
                  <Image source={require('./assets/ICON_HOMEPAGE/moon_icon.png')} style={styles.gridIconImg} />
                  <Text style={styles.gridCardLabel}>TIDUR</Text>
                  <Text style={styles.gridCardValue}>7.1 jam</Text>
                </View>

                <View style={styles.gridCard}>
                  <Image source={require('./assets/ICON_HOMEPAGE/walking_icon.png')} style={styles.gridIconImg} />
                  <Text style={styles.gridCardLabel}>Langkah hari ini</Text>
                  <Text style={styles.gridCardValue}>4.2k</Text>
                </View>
              </View>

              {/* Warning / Alert Panel */}
              <View style={styles.alertCard}>
                <View style={styles.alertIconContainer}>
                  <Image source={require('./assets/ICON_HOMEPAGE/warning_icon.png')} style={styles.alertIconImg} />
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>Pitch suara meningkat</Text>
                  <Text style={styles.alertDesc}>
                    Naik 12% dari kemarin pagi. Pantau aktivitas hari ini.
                  </Text>
                </View>
              </View>

              {/* Progress Mood Tracker */}
              <View style={styles.progressSection}>
                <Text style={styles.progressTitle}>Progress Pengisian Mood Tracker Minggu Ini</Text>
                <View style={styles.ringsContainer}>
                  <ProgressRing day="M" percentage={100} label="100%" />
                  <ProgressRing day="S" percentage={80} label="80%" />
                  <ProgressRing day="S" percentage={50} label="50%" />
                  <ProgressRing day="R" percentage={30} label="30%" />
                  <ProgressRing day="K" percentage={10} label="10%" />
                  <ProgressRing day="J" percentage={0} label="0%" />
                  <ProgressRing day="S" percentage={0} label="0%" />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ==================== TAB: TREN ==================== */}
        {activeTab === 'Tren' && (
          <View style={styles.trenContainer}>
            {/* Header */}
            <View style={styles.trenHeader}>
              <Text style={styles.trenHeaderTitle}>Tren Hari Ini</Text>
              <Text style={styles.trenHeaderSubtitle}>Data 7 Hari Terakhir</Text>
            </View>

            {/* Segmented Control Pill */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segmentBtn, trendFilter === 'Semua' && styles.segmentBtnActive]}
                onPress={() => setTrendFilter('Semua')}
              >
                <Text style={[styles.segmentText, trendFilter === 'Semua' ? styles.segmentTextActive : styles.segmentTextInactive]}>
                  Semua
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, trendFilter === 'Minggu Ini' && styles.segmentBtnActive]}
                onPress={() => setTrendFilter('Minggu Ini')}
              >
                <Text style={[styles.segmentText, trendFilter === 'Minggu Ini' ? styles.segmentTextActive : styles.segmentTextInactive]}>
                  Minggu Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, trendFilter === 'Bulan Ini' && styles.segmentBtnActive]}
                onPress={() => setTrendFilter('Bulan Ini')}
              >
                <Text style={[styles.segmentText, trendFilter === 'Bulan Ini' ? styles.segmentTextActive : styles.segmentTextInactive]}>
                  Bulan Ini
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chart 1: HRV HARIAN */}
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <Text style={styles.chartCardIcon}>📈</Text>
                <Text style={styles.chartCardTitle}>HRV HARIAN (MS)</Text>
              </View>
              <TrendChart
                values={[30, 42, 53, 64, 46, 38, 32]}
                maxY={75}
                showTooltip={true}
                tooltipIndex={3}
                tooltipText="Average 50 ms"
                accentColor="#A88AD3"
              />
            </View>

            {/* Chart 2: BIOMARKER VOKAL */}
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <Text style={styles.chartCardIcon}>📈</Text>
                <Text style={styles.chartCardTitle}>BIOMARKER VOKAL</Text>
              </View>
              <TrendChart
                values={[23, 48, 46, 42, 32, 29, 24]}
                maxY={75}
                showTooltip={false}
                accentColor="#4C307A"
              />
            </View>

            {/* Stats Overview Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Rata-Rata HRV</Text>
                <Text style={styles.statValue}>50 <Text style={styles.statUnit}>ms</Text></Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Fase Stabil</Text>
                <Text style={styles.statValue}>5 <Text style={styles.statUnit}>hari</Text></Text>
              </View>
            </View>
          </View>
        )}

        {/* ==================== TAB: PENGATURAN ==================== */}
        {activeTab === 'Pengaturan' && (
          <View style={styles.pengaturanContainer}>

            {/* Header */}
            <Text style={styles.pengaturanTitle}>Pengaturan</Text>

            {/* Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <Text style={styles.profileName}>Kim Jennie</Text>
              <Text style={styles.profileRole}>Pasien · BIPOLYZER</Text>
            </View>

            {/* Section: Perangkat */}
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionLabel}>PERANGKAT</Text>
              <TouchableOpacity style={styles.settingRow}>
                <View style={styles.settingRowLeft}>
                  <Text style={styles.settingRowTitle}>Koneksi Gelang</Text>
                  <Text style={styles.settingRowSub}>BIPOLYZER-001 · terhubung</Text>
                </View>
                <Text style={styles.settingRowIcon}>⑂</Text>
              </TouchableOpacity>
            </View>

            {/* Section: Notifikasi */}
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionLabel}>NOTIFIKASI</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingRowLeft}>
                  <Text style={styles.settingRowTitle}>Peringatan Fase</Text>
                  <Text style={styles.settingRowSub}>Notifikasi deteksi anomali</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, notifFaseOn ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => setNotifFaseOn(!notifFaseOn)}
                >
                  <View style={[styles.toggleThumb, notifFaseOn ? styles.toggleThumbOn : styles.toggleThumbOff]} />
                </TouchableOpacity>
              </View>

              <View style={[styles.settingRow, styles.settingRowNoBorder]}>
                <View style={styles.settingRowLeft}>
                  <Text style={styles.settingRowTitle}>Pengingat Harian</Text>
                  <Text style={styles.settingRowSub}>Cek kondisi pagi hari</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, notifHarianOn ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => setNotifHarianOn(!notifHarianOn)}
                >
                  <View style={[styles.toggleThumb, notifHarianOn ? styles.toggleThumbOn : styles.toggleThumbOff]} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Emergency Contact */}
            <View style={styles.settingSection}>
              <TouchableOpacity style={[styles.settingRow, styles.settingRowNoBorder]}>
                <Text style={styles.settingRowTitleBold}>Kontak darurat</Text>
                <Text style={styles.settingRowChevron}>›</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}

        {/* ==================== TAB: RIWAYAT ==================== */}
        {activeTab === 'Riwayat' && (
          <View style={styles.riwayatContainer}>

            {/* Header */}
            <Text style={styles.riwayatTitle}>Riwayat Deteksi</Text>
            <Text style={styles.riwayatSubtitle}>Semua Catatan Fase</Text>

            {/* Entry: Fase Stabil (hari ini) */}
            <View style={styles.riwayatCard}>
              <View style={[styles.riwayatIcon, styles.riwayatIconStabil]}>
                <Text style={styles.riwayatIconText}>✓</Text>
              </View>
              <View style={styles.riwayatCardText}>
                <Text style={styles.riwayatCardTitle}>Fase Stabil</Text>
                <Text style={styles.riwayatCardSub}>Hari ini · berlangsung 18 jam</Text>
              </View>
            </View>

            {/* Entry: Potensi Manik Ringan */}
            <View style={styles.riwayatCard}>
              <View style={[styles.riwayatIcon, styles.riwayatIconManik]}>
                <Text style={styles.riwayatIconText}>⚠</Text>
              </View>
              <View style={styles.riwayatCardText}>
                <Text style={styles.riwayatCardTitle}>Potensi Manik Ringan</Text>
                <Text style={styles.riwayatCardSub}>Kam, 19 Jun · 6 jam</Text>
              </View>
            </View>

            {/* Entry: Fase Stabil (lalu) */}
            <View style={styles.riwayatCard}>
              <View style={[styles.riwayatIcon, styles.riwayatIconStabil]}>
                <Text style={styles.riwayatIconText}>✓</Text>
              </View>
              <View style={styles.riwayatCardText}>
                <Text style={styles.riwayatCardTitle}>Fase Stabil</Text>
                <Text style={styles.riwayatCardSub}>Sel–Rab, 10–18 Jun · 8 hari</Text>
              </View>
            </View>

            {/* Entry: Potensi Depresi */}
            <View style={styles.riwayatCard}>
              <View style={[styles.riwayatIcon, styles.riwayatIconDepresi]}>
                <Text style={styles.riwayatIconText}>☹</Text>
              </View>
              <View style={styles.riwayatCardText}>
                <Text style={styles.riwayatCardTitle}>Potensi Depresi</Text>
                <Text style={styles.riwayatCardSub}>Sen, 09 Jun · 1 hari</Text>
              </View>
            </View>

          </View>
        )}

      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Beranda')}>
          <Image
            source={require('./assets/ICON_HOMEPAGE/home_icon.png')}
            style={[styles.navIconImg, activeTab === 'Beranda' ? styles.navIconActive : styles.navIconInactive]}
          />
          <Text style={[styles.navText, activeTab === 'Beranda' ? styles.navTextActive : styles.navTextInactive]}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Tren')}>
          <Image
            source={require('./assets/ICON_HOMEPAGE/tren_icon.png')}
            style={[styles.navIconImg, activeTab === 'Tren' ? styles.navIconActive : styles.navIconInactive]}
          />
          <Text style={[styles.navText, activeTab === 'Tren' ? styles.navTextActive : styles.navTextInactive]}>Tren</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Pengaturan')}>
          <Image
            source={require('./assets/ICON_HOMEPAGE/settings_icon.png')}
            style={[styles.navIconImg, activeTab === 'Pengaturan' ? styles.navIconActive : styles.navIconInactive]}
          />
          <Text style={[styles.navText, activeTab === 'Pengaturan' ? styles.navTextActive : styles.navTextInactive]}>Pengaturan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Riwayat')}>
          <Image
            source={require('./assets/ICON_HOMEPAGE/riwayat_icon.png')}
            style={[styles.navIconImg, activeTab === 'Riwayat' ? styles.navIconActive : styles.navIconInactive]}
          />
          <Text style={[styles.navText, activeTab === 'Riwayat' ? styles.navTextActive : styles.navTextInactive]}>Riwayat</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Background variants
  container: {
    flex: 1,
  },
  bgBeranda: {
    backgroundColor: '#FFFFFF',
  },
  bgTren: {
    backgroundColor: '#A88AD3', // Medium purple background for full screen on Tren
  },
  scrollContainer: {
    paddingBottom: 110,
  },

  // ==================== STYLES: BERANDA ====================
  header: {
    backgroundColor: '#CBB7E2',
    paddingTop: 45,
    paddingBottom: 35,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  phaseCard: {
    backgroundColor: '#A88AD3',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  phaseCardLeft: {
    flex: 1,
  },
  phaseCardLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  phaseCardValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
  },
  phaseCardRight: {
    alignItems: 'flex-end',
  },
  phaseCardDurationLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 4,
  },
  phaseCardDurationValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCard: {
    backgroundColor: '#A88AD3',
    borderRadius: 18,
    padding: 16,
    width: (width - 55) / 2,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  gridIconImg: {
    width: 28,
    height: 28,
    marginBottom: 10,
    tintColor: '#FFFFFF',
  },
  gridCardLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '300',
    marginBottom: 4,
  },
  gridCardValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  alertCard: {
    backgroundColor: '#A88AD3',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  alertIconContainer: {
    marginRight: 16,
  },
  alertIconImg: {
    width: 36,
    height: 36,
    tintColor: '#FFFFFF',
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  alertDesc: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressTitle: {
    color: '#2E1E43',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  ringsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  ringWrapper: {
    alignItems: 'center',
  },
  ringDayText: {
    color: '#4C307A',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  ringOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  ringPercentText: {
    color: '#2E1E43',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 6,
  },

  // ==================== STYLES: TREN ====================
  trenContainer: {
    paddingHorizontal: 20,
  },
  trenHeader: {
    alignItems: 'center',
    paddingTop: 45,
    paddingBottom: 15,
  },
  trenHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -30,
    marginBottom: 4,
    marginLeft: -200
  },
  trenHeaderSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    marginLeft: -188,
    opacity: 0.9,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(76, 48, 122, 0.4)', // Darker transparent purple pill
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#4C307A',
  },
  segmentTextInactive: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartCardIcon: {
    fontSize: 20,
    marginRight: 8,
    color: '#2E1E43',
  },
  chartCardTitle: {
    color: '#2E1E43',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    width: (width - 55) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  statLabel: {
    color: '#8A7B9C',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  statValue: {
    color: '#4C307A',
    fontSize: 24,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8A7B9C',
  },

  // ==================== STYLES: BOTTOM NAV ====================
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 75,
    backgroundColor: '#D5C6E6',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  navIconImg: {
    width: 24,
    height: 24,
    marginBottom: 3,
  },
  navIconActive: {
    opacity: 1,
  },
  navIconInactive: {
    opacity: 0.45,
  },
  navText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  navTextActive: {
    color: '#4C307A',
  },
  navTextInactive: {
    color: '#8A72A6',
  },

  // ==================== STYLES: PENGATURAN ====================
  bgPengaturan: {
    backgroundColor: '#A88AD3',
  },
  pengaturanContainer: {
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  pengaturanTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: -20,
    marginBottom: 24,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D5C6E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 38,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileRole: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.85,
  },
  settingSection: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  settingSectionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.75,
    paddingTop: 14,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  settingRowNoBorder: {
    borderBottomWidth: 0,
  },
  settingRowLeft: {
    flex: 1,
  },
  settingRowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  settingRowTitleBold: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  settingRowSub: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.75,
  },
  settingRowIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    opacity: 0.9,
  },
  settingRowChevron: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    opacity: 0.9,
  },
  // Toggle Switch
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#4C307A',
  },
  toggleOff: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    alignSelf: 'flex-start',
  },

  // ==================== STYLES: RIWAYAT ====================
  bgRiwayat: {
    backgroundColor: '#FFFFFF',
  },
  riwayatContainer: {
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  riwayatTitle: {
    color: '#2E1E43',
    fontSize: 22,
    fontWeight: '800',
    marginTop: -20,
    marginBottom: 10,
  },
  riwayatSubtitle: {
    color: '#8A7B9C',
    fontSize: 16,
    fontWeight: '500',
    marginTop: -10,
    marginBottom: 24,
  },
  riwayatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE5F7',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  riwayatIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  riwayatIconStabil: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6BBF8A',
  },
  riwayatIconManik: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E8A838',
  },
  riwayatIconDepresi: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E06060',
  },
  riwayatIconText: {
    fontSize: 18,
  },
  riwayatCardText: {
    flex: 1,
  },
  riwayatCardTitle: {
    color: '#2E1E43',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  riwayatCardSub: {
    color: '#8A7B9C',
    fontSize: 12,
    fontWeight: '500',
  },
});


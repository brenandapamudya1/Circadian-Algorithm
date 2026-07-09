import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  TextInput,
  Platform,
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
  // ---- Dimension constants ----
  const topPadding = 42;     // room above chart for tooltip box
  const bottomPadding = 32;  // room below chart for X labels
  const paddingLeft = 30;    // left space for Y-axis labels
  const paddingRight = 18;   // right margin so 'Min' label doesn't clip

  // SVG fills card inner content width.
  // trenContainer paddingH=20 + chartCard padding=20 each side → total horizontal margin = 80
  const svgWidth = width - 80;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = 110;
  const svgHeight = topPadding + chartHeight + bottomPadding;

  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const numSegments = days.length - 1; // 6 segments for 7 days

  // Map values to SVG coordinates
  const points = values.map((val, idx) => {
    const x = paddingLeft + (idx * (chartWidth / numSegments));
    const y = topPadding + chartHeight - (val / maxY) * chartHeight;
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

  const gridValues = [0, 25, 50, 75];

  // Tooltip box clamped within SVG bounds
  const tipPt = points[tooltipIndex];
  const tipBoxW = 122;  // wide enough for 'Average 50 ms'
  const tipBoxH = 22;
  const tipBoxX = Math.max(paddingLeft, Math.min(tipPt.x - tipBoxW / 2, paddingLeft + chartWidth - tipBoxW));
  const tipBoxY = Math.max(4, tipPt.y - tipBoxH - 10);

  return (
    <View style={styles.chartWrapper}>
      <Svg height={svgHeight} width={svgWidth}>

        {/* Horizontal grid lines & Y labels */}
        {gridValues.map((gridVal) => {
          const yPos = topPadding + chartHeight - (gridVal / maxY) * chartHeight;
          return (
            <G key={gridVal}>
              <Line
                x1={paddingLeft}
                y1={yPos}
                x2={paddingLeft + chartWidth}
                y2={yPos}
                stroke="#ECDFF6"
                strokeWidth="1"
              />
              <SvgText
                x={paddingLeft - 5}
                y={yPos + 4}
                fill="#9E8CB0"
                fontSize="10"
                textAnchor="end"
              >
                {gridVal}
              </SvgText>
            </G>
          );
        })}

        {/* Outer glow line */}
        <Path
          d={linePath}
          fill="none"
          stroke={`${accentColor}35`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Core trend line */}
        <Path
          d={linePath}
          fill="none"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tooltip + dot */}
        {showTooltip && (
          <G>
            <Rect
              x={tipBoxX}
              y={tipBoxY}
              width={tipBoxW}
              height={tipBoxH}
              rx={6}
              fill="#2E1E43"
            />
            <SvgText
              x={tipBoxX + tipBoxW / 2}
              y={tipBoxY + 14}
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="normal"
              textAnchor="middle"
            >
              {tooltipText}
            </SvgText>
            <Circle
              cx={tipPt.x}
              cy={tipPt.y}
              r={5.5}
              fill={accentColor}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </G>
        )}

        {/* X labels */}
        {days.map((day, idx) => {
          const xPos = paddingLeft + (idx * (chartWidth / numSegments));
          return (
            <SvgText
              key={day}
              x={xPos}
              y={topPadding + chartHeight + 22}
              fill="#5A4570"
              fontSize="11"
              fontWeight="normal"
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

// ==================== DATA: ARTIKEL EDUKASI ====================
interface EduArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  thumbnail: any;
}

const EDU_ARTICLES: EduArticle[] = [
  {
    id: '1',
    title: 'Fase Manik pada Bipolar, Inilah Ciri-Cirinya',
    excerpt: 'Fase manik adalah salah satu episode pada gangguan bipolar yang ditandai dengan lonjakan suasana hati secara ekstrem dan peningkatan energi. Pada fase ini, penderitanya bisa merasa sangat percaya diri, terlalu bersemangat, hingga bertindak impulsif.',
    content: `Fase manik merupakan episode dalam gangguan bipolar yang membuat suasana hati penderitanya meningkat secara ekstrem, sering kali disalahpahami hanya sebagai perasaan gembira atau sangat produktif. Pada fase ini, terjadi lonjakan emosi disertai peningkatan aktivitas dan energi yang signifikan, sehingga perilaku penderita bisa menjadi sulit dikendalikan dan cenderung mengambil keputusan yang berisiko.\n\nAda beberapa gejala khas yang umumnya muncul selama fase manik, di antaranya:\n\n1. Suasana hati yang sangat tinggi (euforia berlebihan) atau menjadi sangat mudah marah secara tiba-tiba terhadap hal sepele.\n2. Berbicara dengan sangat cepat, terus-menerus, dan topiknya meloncat-loncat sehingga sulit diikuti atau dihentikan.\n3. Pikiran yang terlalu aktif dan penuh ide, namun penderita menjadi sulit fokus dan konsentrasinya menurun.\n4. Kebutuhan tidur yang berkurang, di mana penderita tetap merasa segar dan sangat aktif meski hanya tidur beberapa jam saja.\n5. Rasa percaya diri yang berlebihan di luar kewajaran, bahkan merasa memiliki kekuatan atau talenta khusus.\n6. Bertindak impulsif tanpa memikirkan risiko, seperti berbelanja berlebihan hingga menguras tabungan, mengemudi ugal-ugalan, atau berjudi.\n7. Mudah tersulut emosi sehingga sering terlibat dalam perdebatan atau pertengkaran tanpa sebab yang jelas.\n8. Mengalami perubahan libido (dorongan seksual meningkat tajam) serta perubahan nafsu makan yang tidak teratur.\n\nMeskipun penyebab pasti fase manik belum diketahui, ada beberapa faktor risiko yang memicunya, seperti riwayat keluarga, stres berat, jadwal tidur tidak teratur, penyalahgunaan alkohol/obat terlarang, serta penghentian obat tanpa pengawasan dokter.\n\nPenanganan untuk fase manik harus dilakukan secara menyeluruh melalui kombinasi konsultasi dengan psikiater, pemberian obat-obatan (seperti penstabil mood dan antipsikotik), psikoterapi (terapi perilaku kognitif), penyesuaian pola hidup sehat, serta dukungan penuh dari keluarga. Pada kasus yang parah atau membahayakan keselamatan, perawatan rawat inap di rumah sakit jiwa mungkin akan direkomendasikan.`,
    sourceName: 'Alodokter',
    sourceUrl: 'https://www.alodokter.com/fase-manik-pada-bipolar-inilah-ciri-cirinya',
    thumbnail: require('./assets/edu/artikel_1.png'),
  },
  {
    id: '2',
    title: '5 Langkah Sederhana untuk Mengatasi Depresi bagi Orang Dewasa',
    excerpt: 'Depresi dapat membuat seseorang merasa tidak bersemangat dan cenderung menarik diri dari lingkungan. Melalui langkah sederhana seperti tetap terhubung dengan orang terdekat, aktif bergerak, dan menjaga pola makan, gejala depresi dapat diredakan secara bertahap.',
    content: `Depresi merupakan gangguan kesehatan mental yang dapat menguras energi, membuat seseorang merasa sedih berkepanjangan, hingga kehilangan minat pada aktivitas sehari-hari. Walaupun terasa berat, terdapat beberapa langkah sederhana yang bisa dilakukan oleh orang dewasa untuk membantu mengatasi dan memulihkan kondisi dari depresi:\n\n1. Tetap berhubungan dengan orang lain: Saat mengalami depresi, seseorang cenderung mengisolasi diri karena merasa malu atau terlalu lelah untuk bersosialisasi. Padahal, dukungan dari keluarga dan teman terdekat sangat krusial dalam menjaga perspektif yang sehat serta meningkatkan suasana hati.\n\n2. Lakukan hal-hal yang menyenangkan: Dorong diri sendiri untuk meluangkan waktu melakukan hobi atau aktivitas yang disukai sebelumnya, seperti mendengarkan musik atau pergi bersama teman. Langkah ini membantu memicu emosi positif dan mengembalikan energi secara bertahap.\n\n3. Aktif bergerak: Meskipun bangun dari tempat tidur terasa sulit, olahraga teratur terbukti efektif meredakan gejala depresi setara dengan efektivitas obat-obatan tertentu. Cukup mulai dengan aktivitas ringan seperti berjalan kaki selama 10 menit per hari untuk membantu meningkatkan suasana hati.\n\n4. Konsumsi makanan sehat anti depresi: Kurangi konsumsi kafein, alkohol, makanan berlemak, atau makanan dengan pengawet tinggi yang dapat memengaruhi otak. Sebaliknya, tingkatkan suasana hati dengan mengonsumsi makanan yang kaya asam lemak omega-3 (seperti tuna dan salmon) serta makanan tinggi vitamin B yang berperan penting dalam menstabilkan mood.\n\n5. Hubungi profesional jika diperlukan: Jika langkah-langkah mandiri tersebut dirasa belum cukup membantu mengontrol gejala yang dirasakan, segera hubungi profesional kesehatan mental seperti psikolog atau psikiater untuk mendapatkan penanganan dan terapi yang tepat.`,
    sourceName: 'Halodoc',
    sourceUrl: 'https://www.halodoc.com/artikel/5-langkah-sederhana-untuk-mengatasi-depresi-bagi-orang-dewasa',
    thumbnail: require('./assets/edu/artikel_2.png'),
  },
  {
    id: '3',
    title: 'Bagaimana Sleep Hygiene Dapat Membantu Menstabilkan Suasana Hati pada Gangguan Bipolar',
    excerpt: 'Gangguan tidur erat kaitannya dengan perubahan suasana hati yang ekstrem pada penderita bipolar. Menerapkan sleep hygiene atau kebiasaan tidur yang sehat terbukti efektif membantu menjaga stabilitas emosi dan mencegah kekambuhan fase manik maupun depresi.',
    content: `Bagi penderita gangguan bipolar, tidur bukan sekadar waktu untuk beristirahat, melainkan pilar krusial dalam menjaga stabilitas kesehatan mental. Gangguan pada ritme sirkadian (jam biologis tubuh) sering kali menjadi pemicu utama terjadinya transisi suasana hati yang ekstrem. Kurang tidur dapat memicu munculnya fase manik (episode gembira/aktif berlebihan), sementara tidur berlebihan atau pola tidur yang kacau sering kali menyertai fase depresi.\n\nUntuk meminimalkan risiko fluktuasi suasana hati tersebut, penerapan sleep hygiene (kebiasaan tidur yang bersih dan sehat) sangat direkomendasikan sebagai bagian dari manajemen mandiri:\n\n1. Menjaga jadwal tidur yang konsisten: Pergi tidur dan bangun pada jam yang sama setiap hari—termasuk pada akhir pekan—membantu melatih jam biologis tubuh agar tetap sinkron dan stabil.\n\n2. Menciptakan lingkungan kamar yang ideal: Kondisikan ruang tidur agar tetap sejuk, tenang, dan gelap. Penggunaan tirai gelap (blackout curtains) atau masker mata dapat membantu meningkatkan kualitas tidur yang lebih nyenyak.\n\n3. Membatasi paparan layar sebelum tidur: Pancaran sinar biru (blue light) dari ponsel, laptop, atau televisi dapat menghambat produksi melatonin, yaitu hormon yang memicu rasa kantuk. Matikan perangkat elektronik setidaknya 30 hingga 60 menit sebelum tidur.\n\n4. Memperhatikan konsumsi menjelang malam: Hindari makanan berat, kafein, dan alkohol di malam hari. Meskipun alkohol terkadang membuat cepat mengantuk, zat ini justru merusak struktur tidur dan sering kali memicu terbangun di tengah malam.\n\n5. Membangun ritual santai sebelum tidur: Lakukan aktivitas yang menenangkan sebelum berbaring, seperti membaca buku fisik, mandi air hangat, atau melakukan teknik pernapasan dan meditasi ringan untuk memberi sinyal pada tubuh bahwa waktu istirahat telah tiba.\n\nMeskipun sleep hygiene sangat membantu menjaga kestabilan mood, langkah ini merupakan pendukung dan bukan pengganti pengobatan medis utama. Penanganan gangguan bipolar tetap memerlukan kombinasi yang konsisten antara terapi dari profesional kesehatan mental dan konsumsi obat penstabil mood yang diresepkan dokter.`,
    sourceName: 'The Supportive Care',
    sourceUrl: 'https://www-thesupportivecare-com.translate.goog/blog/how-sleep-hygiene-can-help-stabilize-mood-in-bipolar-disorder',
    thumbnail: require('./assets/edu/artikel_3.png'),
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'Beranda' | 'Tren' | 'Pengaturan' | 'Riwayat'>('Beranda');
  const [trendFilter, setTrendFilter] = useState<'Semua' | 'Minggu Ini' | 'Bulan Ini'>('Semua');
  const [notifFaseOn, setNotifFaseOn] = useState<boolean>(true);
  const [notifHarianOn, setNotifHarianOn] = useState<boolean>(false);
  const [selectedEduArticle, setSelectedEduArticle] = useState<EduArticle | null>(null);

  // ── Web Specific Title & Favicon Setup ──
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Bypolizer';
      
      try {
        const iconUri = Image.resolveAssetSource(require('./assets/icon_app.png')).uri;
        
        // Update or create standard favicon link
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = iconUri;
        link.type = 'image/png';
        
        // Update or create apple-touch-icon link
        let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
        if (!appleLink) {
          appleLink = document.createElement('link');
          appleLink.rel = 'apple-touch-icon';
          document.getElementsByTagName('head')[0].appendChild(appleLink);
        }
        appleLink.href = iconUri;
      } catch (err) {
        console.warn('Gagal memuat dynamic favicon:', err);
      }
    }
  }, []);

  // ── Reminder State & Interface ──
  interface Reminder {
    id: string;
    label: string;
    time: string;
    active: boolean;
    type: 'obat' | 'olahraga';
  }

  const [reminders, setReminders] = useState<Reminder[]>([
    { id: '1', label: 'Minum Obat Pagi (Lithium)', time: '07:00', active: true, type: 'obat' },
    { id: '2', label: 'Olahraga Sore (Jalan Kaki)', time: '16:30', active: true, type: 'olahraga' },
    { id: '3', label: 'Minum Obat Malam', time: '21:00', active: false, type: 'obat' },
  ]);

  // Form State untuk tambah manual
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('08:00');
  const [newType, setNewType] = useState<'obat' | 'olahraga'>('obat');

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(rem => rem.id === id ? { ...rem, active: !rem.active } : rem));
  };

  const handleSaveReminder = () => {
    if (!newLabel.trim()) return;
    const newRem: Reminder = {
      id: Date.now().toString(),
      label: newLabel,
      time: newTime,
      active: true,
      type: newType,
    };
    setReminders(prev => [...prev, newRem]);
    // Reset Form
    setNewLabel('');
    setNewTime('08:00');
    setNewType('obat');
    setShowAddForm(false);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(prev => prev.filter(rem => rem.id !== id));
  };

  // ── Lock Screen State ──
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [pinVerified, setPinVerified] = useState<boolean>(false); // Mulai render background app
  const lockOpacity = useRef(new Animated.Value(1)).current;
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const DEMO_PIN = '1234'; // PIN demo untuk presentasi

  const handlePinPress = (digit: string) => {
    if (pinInput.length >= 4) return;
    const newPin = pinInput + digit;
    setPinInput(newPin);
    setPinError(false);

    if (newPin.length === 4) {
      if (newPin === DEMO_PIN) {
        setPinVerified(true); // Render Main App di background
        setTimeout(() => {
          Animated.timing(lockOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => {
            setIsUnlocked(true);
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

  // ── Splash Screen State ──
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const splashOpacity = useRef(new Animated.Value(1)).current; // start at 1 = langsung terlihat

  useEffect(() => {
    // After 1000ms: fade-out (300ms) lalu unmount → total tampil ~1.3s
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // ──_ NOTE: splash rendered as absolute overlay below, NOT early return ──

  return (
    <>
      {/* ── Main App (Rendered in background when transitioning/unlocked) ── */}
      {(isUnlocked || pinVerified) && (
        <SafeAreaView style={[
          styles.container,
          activeTab === 'Tren' ? styles.bgTren
            : activeTab === 'Pengaturan' ? styles.bgPengaturan
              : activeTab === 'Riwayat' ? styles.bgRiwayat
                : styles.bgBeranda
        ]}>

          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >

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
                    <Image
                      source={require('./assets/ICON_HOMEPAGE/graph_icon.png')}
                      style={styles.chartCardIconImg}
                    />
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
                    <Image
                      source={require('./assets/ICON_HOMEPAGE/graph_icon.png')}
                      style={styles.chartCardIconImg}
                    />
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

                {/* Section: Pengingat Kesehatan (Reminder) */}
                <View style={styles.settingSection}>
                  <Text style={styles.settingSectionLabel}>PENGINGAT KESEHATAN</Text>

                  {reminders.map((reminder, index) => {
                    const isLast = index === reminders.length - 1;
                    return (
                      <View key={reminder.id} style={[styles.reminderRow, isLast && styles.reminderRowNoBorder]}>
                        <View style={styles.reminderLeft}>
                          <View style={styles.reminderMeta}>
                            <Text style={styles.reminderTitle}>{reminder.label}</Text>
                            <Text style={styles.reminderTime}>{reminder.time} · {reminder.type === 'obat' ? 'Obat' : 'Olahraga'}</Text>
                          </View>
                        </View>

                        <View style={styles.reminderRightActions}>
                          <TouchableOpacity
                            style={[styles.toggle, reminder.active ? styles.toggleOn : styles.toggleOff]}
                            onPress={() => toggleReminder(reminder.id)}
                          >
                            <View style={[styles.toggleThumb, reminder.active ? styles.toggleThumbOn : styles.toggleThumbOff]} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.deleteReminderTextBtn}
                            onPress={() => handleDeleteReminder(reminder.id)}
                          >
                            <Text style={styles.deleteReminderText}>Hapus</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {/* Form Tambah Manual */}
                  {showAddForm ? (
                    <View style={styles.addReminderForm}>
                      <Text style={styles.formLabel}>Nama Pengingat</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Contoh: Minum Vitamin C"
                        value={newLabel}
                        onChangeText={setNewLabel}
                        placeholderTextColor="#A89CB8"
                      />

                      <Text style={styles.formLabel}>Waktu (Jam)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Contoh: 08:00"
                        value={newTime}
                        onChangeText={setTime => {
                          // Simple regex/auto format could go here, for demo simple string is fine
                          setNewTime(setTime);
                        }}
                        placeholderTextColor="#A89CB8"
                      />

                      <Text style={styles.formLabel}>Kategori</Text>
                      <View style={styles.formTypeRow}>
                        <TouchableOpacity
                          style={[styles.formTypeBtn, newType === 'obat' && styles.formTypeBtnActive]}
                          onPress={() => setNewType('obat')}
                        >
                          <Text style={[styles.formTypeBtnText, newType === 'obat' && styles.formTypeBtnTextActive]}> Obat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.formTypeBtn, newType === 'olahraga' && styles.formTypeBtnActive]}
                          onPress={() => setNewType('olahraga')}
                        >
                          <Text style={[styles.formTypeBtnText, newType === 'olahraga' && styles.formTypeBtnTextActive]}> Olahraga</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.formActions}>
                        <TouchableOpacity
                          style={styles.formCancelBtn}
                          onPress={() => setShowAddForm(false)}
                        >
                          <Text style={styles.formCancelBtnText}>Batal</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.formSaveBtn}
                          onPress={handleSaveReminder}
                        >
                          <Text style={styles.formSaveBtnText}>Simpan</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* Add Reminder Button */
                    <TouchableOpacity
                      style={styles.addReminderBtn}
                      onPress={() => setShowAddForm(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addReminderBtnText}>+ Tambah Pengingat</Text>
                    </TouchableOpacity>
                  )}
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

                {/* ── Artikel Edukasi Section ── */}
                {selectedEduArticle === null ? (
                  <View style={styles.eduSection}>
                    <Text style={styles.eduSectionTitle}>Artikel Edukasi</Text>
                    <Text style={styles.eduSectionSubtitle}>Pelajari lebih lanjut tentang fase bipolar</Text>

                    {EDU_ARTICLES.map((article) => (
                      <TouchableOpacity
                        key={article.id}
                        style={styles.eduCard}
                        onPress={() => setSelectedEduArticle(article)}
                        activeOpacity={0.88}
                      >
                        <Image
                          source={article.thumbnail}
                          style={styles.eduThumbnail}
                          resizeMode="cover"
                        />
                        <View style={styles.eduCardBody}>
                          <Text style={styles.eduCardTitle} numberOfLines={2}>{article.title}</Text>
                          <Text style={styles.eduCardExcerpt} numberOfLines={3}>{article.excerpt}</Text>
                          <View style={styles.eduCardSource}>
                            <Text style={styles.eduSourceName}>{article.sourceName}</Text>
                            <Text style={styles.eduSourceUrl} numberOfLines={1}>{article.sourceUrl}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  /* ── Detail View ── */
                  <View style={styles.eduDetail}>
                    <TouchableOpacity
                      style={styles.eduDetailBack}
                      onPress={() => setSelectedEduArticle(null)}
                    >
                      <Text style={styles.eduDetailBackText}>← Kembali</Text>
                    </TouchableOpacity>

                    <Image
                      source={selectedEduArticle.thumbnail}
                      style={styles.eduDetailThumbnail}
                      resizeMode="cover"
                    />

                    <View style={styles.eduDetailBody}>
                      <Text style={styles.eduDetailTitle}>{selectedEduArticle.title}</Text>

                      <View style={styles.eduDetailSourceRow}>
                        <Text style={styles.eduDetailSourceName}>{selectedEduArticle.sourceName}</Text>
                      </View>

                      <Text style={styles.eduDetailContent}>{selectedEduArticle.content}</Text>

                      <View style={styles.eduDetailUrlRow}>
                        <Text style={styles.eduDetailUrlLabel}>Sumber: </Text>
                        <Text style={styles.eduDetailUrl} numberOfLines={2}>{selectedEduArticle.sourceUrl}</Text>
                      </View>
                    </View>
                  </View>
                )}

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
      )}

      {/* ── Lock Screen Overlay (Fades out when pinVerified) ── */}
      {!isUnlocked && (
        <Animated.View style={[styles.lockContainerAbsolute, { opacity: lockOpacity }]}>
          <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="dark" />

            {/* Logo kecil di atas */}
            <Image
              source={require('./assets/icon_app_trans.png')}
              style={styles.lockLogo}
              resizeMode="contain"
            />

            {/* Judul */}
            <Text style={styles.lockTitle}>Masukkan PIN</Text>
            <Text style={styles.lockSubtitle}>Masukkan 4 digit PIN untuk melanjutkan</Text>

            {/* 4 Dot Indicator */}
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

            {/* Error message */}
            {pinError && (
              <Text style={styles.lockErrorText}>PIN salah, coba lagi</Text>
            )}

            {/* Keypad */}
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
                        source={require('./assets/lockscreen/delete_icon.png')}
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

            {/* Biometrik placeholder */}
            <TouchableOpacity style={styles.lockBiometric} activeOpacity={0.7}>
              <Text style={styles.lockBiometricText}>Gunakan Biometrik</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* ── Splash Overlay (absolute, fades out to reveal main app) ── */}
      {showSplash && (
        <Animated.View style={[styles.splashContainer, styles.splashAbsolute, { opacity: splashOpacity }]}>
          <StatusBar style="dark" />
          <Image
            source={require('./assets/icon_app_trans.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </>
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
    paddingBottom: 20,
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
  chartCardIconImg: {
    width: 22,
    height: 22,
    marginRight: 8,
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
    paddingBottom: 16,
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

  // ==================== STYLES: SPLASH SCREEN ====================
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: width * 0.62,
    height: width * 0.85,
  },
  splashAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },

  // ==================== STYLES: EDUKASI ====================
  eduSection: {
    marginTop: 28,
    paddingBottom: 8,
  },
  eduSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2E1E43',
    marginBottom: 2,
  },
  eduSectionSubtitle: {
    fontSize: 12,
    color: '#8A7B9C',
    marginBottom: 16,
    fontWeight: '400',
  },
  eduCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#A88AD3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  eduThumbnail: {
    width: '100%',
    height: 170,
    backgroundColor: '#EDE5F7',
  },
  eduCardBody: {
    padding: 14,
  },
  eduCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
    lineHeight: 21,
  },
  eduCardExcerpt: {
    fontSize: 13,
    color: '#5A4570',
    lineHeight: 19,
    marginBottom: 10,
  },
  eduCardSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eduSourceDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#A88AD3',
  },
  eduSourceName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E1E43',
  },
  eduSourceUrl: {
    fontSize: 11,
    color: '#9B8CB0',
    flex: 1,
  },

  // \u2500\u2500 Detail View \u2500\u2500
  eduDetail: {
    marginTop: 12,
    paddingBottom: 20,
  },
  eduDetailBack: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  eduDetailBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B5EA7',
  },
  eduDetailThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#EDE5F7',
    marginBottom: 16,
  },
  eduDetailBody: {
    paddingHorizontal: 2,
  },
  eduDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    lineHeight: 25,
    marginBottom: 10,
  },
  eduDetailSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  eduDetailSourceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7B5EA7',
  },
  eduDetailContent: {
    fontSize: 14,
    color: '#3A2E4A',
    lineHeight: 22,
    marginBottom: 20,
  },
  eduDetailUrlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    backgroundColor: '#F3EEF9',
    borderRadius: 8,
    padding: 10,
  },
  eduDetailUrlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A4570',
  },
  eduDetailUrl: {
    fontSize: 12,
    color: '#7B5EA7',
    flex: 1,
  },

  // ==================== STYLES: LOCK SCREEN ====================
  lockContainerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  lockLogo: {
    width: 90,
    height: 90,
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E1E43',
    marginBottom: 4,
  },
  lockSubtitle: {
    fontSize: 13,
    color: '#8A7B9C',
    marginBottom: 28,
  },
  lockDotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 12,
  },
  lockDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  lockDotEmpty: {
    backgroundColor: '#E8E0F0',
    borderWidth: 1.5,
    borderColor: '#D0C4DE',
  },
  lockDotFilled: {
    backgroundColor: '#7B5EA7',
    borderWidth: 0,
  },
  lockDotError: {
    backgroundColor: '#E06060',
    borderWidth: 0,
  },
  lockErrorText: {
    fontSize: 13,
    color: '#E06060',
    fontWeight: '500',
    marginBottom: 8,
  },
  lockKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 260,
    marginTop: 16,
  },
  lockKey: {
    width: 72,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
    borderRadius: 16,
    backgroundColor: '#F3EEF9',
  },
  lockKeyEmpty: {
    width: 72,
    height: 60,
    margin: 6,
  },
  lockKeyText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#2E1E43',
  },
  lockKeyTextDel: {
    fontSize: 24,
    color: '#7B5EA7',
  },
  lockKeyDelIcon: {
    width: 26,
    height: 26,
    // tintColor: '#7B5EA7',
  },
  lockBiometric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#F3EEF9',
  },
  lockBiometricIcon: {
    fontSize: 18,
  },
  lockBiometricText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7B5EA7',
  },

  // ==================== STYLES: REMINDERS ====================
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  reminderRowNoBorder: {
    borderBottomWidth: 0,
    paddingBottom: 6,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remIconObatBg: {
    backgroundColor: '#FFEBF0', // merah muda pastel
  },
  remIconOlahBg: {
    backgroundColor: '#EBF3FF', // biru muda pastel
  },
  reminderEmoji: {
    fontSize: 18,
  },
  reminderMeta: {
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  reminderTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  reminderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteReminderTextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  deleteReminderText: {
    fontSize: 12,
    color: '#cd0014ff', // pink/merah terang pastel kontras di background ungu
    fontWeight: '600',
  },
  addReminderBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#7B5EA7',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReminderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B5EA7',
  },

  // ── Form Tambah Pengingat ──
  addReminderForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F7F4FB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DFF5',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C447C',
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCD3EA',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2E1E43',
  },
  formTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  formTypeBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCD3EA',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTypeBtnActive: {
    backgroundColor: '#E2D9F3',
    borderColor: '#7B5EA7',
  },
  formTypeBtnText: {
    fontSize: 13,
    color: '#8A7B9C',
    fontWeight: '600',
  },
  formTypeBtnTextActive: {
    color: '#4C307A',
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  formCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCD3EA',
  },
  formCancelBtnText: {
    fontSize: 13,
    color: '#8A7B9C',
    fontWeight: '600',
  },
  formSaveBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#7B5EA7',
  },
  formSaveBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});


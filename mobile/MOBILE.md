# BIPOLYZER Mobile Application (Android & iOS)

Aplikasi mobile BIPOLYZER dirancang sebagai aplikasi standalone lintas platform yang bertindak sebagai hub pengolah data sensor secara lokal dari wearable device (ESP32) menggunakan koneksi Bluetooth Low Energy (BLE), menyimpan data dan baseline ke dalam database SQLite lokal di smartphone, serta menjalankan algoritma klasifikasi jendela biologis (Circadian) dan Gating secara real-time.

---

## 1. Tech Stack

Aplikasi mobile ini dibangun menggunakan teknologi modern yang berfokus pada efisiensi daya, performa native, dan kapabilitas offline-first:

| Komponen | Teknologi | Alasan |
| :--- | :--- | :--- |
| **Framework Utama** | React Native (Expo SDK) | Pengembangan lintas platform (iOS & Android) dengan kinerja native yang cepat dan tooling Expo yang matang. |
| **Bahasa Pemrograman**| TypeScript | Menjamin keamanan tipe data (type-safety) selama porting kontrak data dari Python. |
| **Koneksi Bluetooth** | `react-native-ble-plx` | Library BLE terlengkap untuk React Native yang mendukung sinkronisasi background dan pertukaran data GATT secara asinkron. |
| **Database Lokal** | `expo-sqlite` | Driver SQLite native yang ringan untuk penyimpanan data baseline personal dan riwayat fitur secara offline. |
| **State Management** | Zustand | State management minimalis, cepat, dan mudah diintegrasikan dengan sinkronisasi data BLE. |
| **Grafik & SVG** | `react-native-svg` | Rendering grafik tren (HRV, Vokal, Mood) langsung via SVG native tanpa library charting pihak ketiga. |
| **Push Notification** | `expo-notifications` | Local push notification terjadwal untuk fitur Reminder (minum obat & olahraga) secara offline. |
| **Keamanan Biometrik** | `expo-local-authentication` | Akses Face ID / Fingerprint untuk autentikasi layar kunci. |
| **Penyimpanan Aman** | `expo-secure-store` | Enklave penyimpanan aman untuk menyimpan hash PIN agar tidak terbaca aplikasi lain. |
| **Desain Antarmuka** | React Native StyleSheet | Styling native berbasis StyleSheet dengan palet warna ungu premium (dark-light theme). |

---

## 2. Alur Pengiriman BLE & Pemrosesan Data

Sistem pengiriman menggunakan skema **Batch Transmission (Setiap 15 Detik Sekali)** untuk menyeimbangkan performa transfer data dan efisiensi daya baterai pada wearable device.

### Diagram Alur Data (End-to-End)
```mermaid
graph TD
    subgraph ESP32 Wearable
        Sensors["MAX30102 / INMP441 / MPU6050"] --> Preprocess["Preprocessing Ringan di ESP32 (Ekstrak Pitch F0 & RR-Interval)"]
        Preprocess --> BLETx["Kirim Fitur Ringan via BLE (Karakteristik GATT)"]
    end

    subgraph "Mobile App (Android & iOS)"
        BLETx -->|Receive BLE Notification| BLERx["BLE Receiver"]
        BLERx --> Buffer["Sliding Buffer 30s"]
        
        Buffer --> Classifier["Window Classifier (Konversi ke Waktu Lokal Biologis)"]
        Classifier --> DBRead["Baca Baseline dari SQLite (Tabel circadian_baselines)"]
        
        DBRead --> Normalizer["Normalizer (Hitung Z-Score)"]
        Normalizer --> Gating["Gating Rules Engine (Jalankan GR-01 s/d GR-05)"]
        
        Gating --> Builder["Vector Builder (Validasi Circadian)"]
        
        Builder --> DBSave["Simpan ke SQLite (Tabel feature_vectors)"]
        Builder -->|EMA Update harian| DBBaselineUpdate["Update Baseline harian (Tabel circadian_baselines)"]
    end
```

### Detil Protokol BLE GATT:
- **Service UUID:** `19B10000-E8F2-537E-4F6C-D104768A1214`
- **Karakteristik & Payload:**
  - **HRV (Notify) - `19B10001-...`:** Mengirim array RR-Interval (float32 list) yang di-serialize menjadi string JSON kecil.
  - **Vocal (Notify) - `19B10002-...`:** Mengirim nilai rata-rata F0 dan intensitas suara.
  - **IMU (Notify) - `19B10003-...`:** Mengirim nilai keaktifan (activity level, transitions, dan dwell time).
- **Fragmentasi Paket:** Untuk payload di atas MTU default (~20 bytes), paket dipecah dengan format header: `[Sequence ID (1 byte)] [Total Packets (1 byte)] [Payload]`.

---

## 3. Skema Database SQLite Lokal

Database SQLite lokal pada perangkat HP bertindak sebagai penyimpan data jangka pendek untuk kalkulasi baseline adaptif dan audit log.

### A. Tabel `circadian_baselines`
Menyimpan baseline adaptif (mean & std) per window untuk proses normalisasi z-score.
```sql
CREATE TABLE IF NOT EXISTS circadian_baselines (
    window_name TEXT PRIMARY KEY,
    hrv_rmssd_mean REAL NOT NULL,
    hrv_rmssd_std REAL NOT NULL,
    vocal_f0_mean REAL NOT NULL,
    vocal_f0_std REAL NOT NULL,
    imu_dwell_mean REAL NOT NULL,
    imu_dwell_std REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### B. Tabel `feature_vectors`
Menyimpan riwayat vektor fitur yang lolos/gagal validasi sirkadian.
```sql
CREATE TABLE IF NOT EXISTS feature_vectors (
    epoch_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    window_name TEXT NOT NULL,
    hrv_rmssd REAL,
    hrv_zscore REAL,
    vocal_f0 REAL,
    vocal_zscore REAL,
    imu_dwell_min REAL,
    imu_zscore REAL,
    circadian_valid INTEGER NOT NULL,  -- 0 = False, 1 = True
    suppressed_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### C. Tabel `mood_logs` *(Baru — Fitur Mood Tracker)*
Menyimpan input skala mood harian dari pengguna (1–10).
```sql
CREATE TABLE IF NOT EXISTS mood_logs (
    log_id TEXT PRIMARY KEY,
    logged_date TEXT NOT NULL,       -- format: YYYY-MM-DD
    mood_score INTEGER NOT NULL,     -- skala 1-10
    note TEXT,                       -- catatan opsional
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### D. Tabel `reminders` *(Baru — Fitur Reminder)*
Menyimpan jadwal pengingat yang dibuat pengguna.
```sql
CREATE TABLE IF NOT EXISTS reminders (
    reminder_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,             -- contoh: 'Minum Obat Pagi'
    type TEXT NOT NULL,              -- 'medication' | 'exercise'
    time TEXT NOT NULL,              -- format: HH:MM
    repeat_days TEXT NOT NULL,       -- JSON array, contoh: '["Mon","Wed","Fri"]'
    is_active INTEGER DEFAULT 1,     -- 0 = off, 1 = on
    notification_id TEXT,            -- ID dari expo-notifications untuk cancel
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### E. Tabel `gamification_progress` *(Baru — Fitur Gamifikasi)*
Menyimpan akumulasi poin dan badge yang sudah diraih pengguna.
```sql
CREATE TABLE IF NOT EXISTS gamification_progress (
    user_id TEXT PRIMARY KEY DEFAULT 'local_user',
    total_points INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_active_date TEXT,           -- format: YYYY-MM-DD
    badges_unlocked TEXT DEFAULT '[]', -- JSON array nama badge
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### F. Tabel `notification_logs` *(Baru — Sistem Notifikasi)*
Menyimpan log notifikasi yang telah dikirim untuk tracking konfirmasi dan menghindari redundansi.
```sql
CREATE TABLE IF NOT EXISTS notification_logs (
    log_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,              -- 'phase_summary' | 'medication' | 'exercise' | 'daily_check'
    reference_id TEXT,               -- reminder_id atau tanggal (YYYY-MM-DD) untuk phase_summary
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'confirmed' | 'dismissed'
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME
);
```

---

## 4. Struktur Folder Project (React Native Tree)

Kerangka proyek di bawah direktori `mobile/` ditata secara modular untuk memisahkan logika UI, BLE, Database, dan Algoritma Sirkadian (Porting dari Python):

```
mobile/
│
├── MOBILE.md                    ← Dokumen ini
├── package.json
├── tsconfig.json
├── App.tsx                      ← Entrypoint & orchestrator (slim)
│
├── assets/
│   ├── ICON_HOMEPAGE/           ← Ikon PNG custom (heart, mic, moon, dll.)
│   ├── edu/                     ← Thumbnail artikel edukasi
│   └── lockscreen/              ← Aset lock screen
│
└── src/
    ├── constants/
    │   └── theme.ts             ← Semua StyleSheet & color definitions
    │
    ├── components/              ← UI reusable
    │   ├── AlertPanel.tsx       ← Alert anomali/gating/normal/disconnected
    │   ├── BleScannerModal.tsx  ← Modal scan BLE + BT state checker
    │   ├── BottomNav.tsx        ← Bottom tab navigation
    │   ├── LockScreen.tsx       ← Layar kunci PIN
    │   ├── MetricCard.tsx       ← Card metric Beranda
    │   ├── ProgressRing.tsx     ← Ring progress mood tracker
    │   ├── SplashScreen.tsx     ← Splash overlay
    │   └── TrendChart.tsx       ← Komponen grafik SVG tren (flexibel)
    │
    ├── data/
    │   └── educationContent.ts  ← Konten edukasi per fase (bundled)
    │
    ├── database/                ← Pengelolaan SQLite
    │   ├── sqlite.ts            ← Inisialisasi DB & Eksekusi Query
    │   └── queries.ts           ← CRUD: baselines, feature_vectors,
    │                               mood_logs, reminders, gamification,
    │                               notification_logs
    │
    ├── services/                ← Background services
    │   ├── bleManager.ts        ← Logika Scan, Connect, Listen BLE + BT state
    │   ├── syncService.ts       ← Buffer BLE → Pipeline → SQLite
    │   └── notificationService.ts ← Scheduling, cancel, phase summary
    │
    ├── circadian/               ← Porting Logika Python → TypeScript
    │   ├── windowClassifier.ts
    │   ├── baselineManager.ts
    │   ├── normalizer.ts
    │   ├── gatingRules.ts
    │   └── pipeline.ts
    │
    └── views/                   ← Halaman aplikasi
        ├── HomeScreen.tsx       ← Dashboard real-time (Tab Beranda)
        ├── TrenScreen.tsx       ← Grafik HRV, Vokal (Tab Tren) + filter
        ├── SettingsScreen.tsx   ← BLE, Notifikasi, Reminder (Tab Pengaturan)
        └── RiwayatScreen.tsx    ← Riwayat fase + artikel edukasi (Tab Riwayat)
```

---

## 5. Sistem Notifikasi

Sistem notifikasi menggunakan `expo-notifications` untuk push notification lokal (tanpa server backend). Terdapat 4 jenis notifikasi:

### A. Peringatan Fase (Phase Summary)
- **Trigger:** Scheduled tiap hari jam 21:00 (bisa diubah)
- **Logika:** Kumpulkan semua `feature_vectors` hari itu yang `circadian_valid = 0`
- **Anti-redundansi:** Cek `notification_logs` sebelum kirim, skip jika sudah dikirim hari itu
- **Isi Notifikasi:**

```
┌─────────────────────────────────────┐
│ ⚠️ Ringkasan Sirkadian Hari Ini     │
│                                     │
│ 3 anomali terdeteksi hari ini:      │
│ • MORNING (08:32) - HRV tinggi      │
│ • AFTERNOON (14:15) - Vokal naik    │
│ • EVENING (19:47) - IMU tidak wajar │
│                                     │
│ Tap untuk lihat detail →            │
└─────────────────────────────────────┘
```

### B. Pengingat Obat/Olahraga (Reminder)
- **Trigger:** Sesuai jadwal user dari tabel `reminders`
- **Scheduling:** `notificationService.scheduleReminder()` dengan weekly trigger
- **Cancel:** Otomatis saat user toggle off atau hapus reminder
- **Anti-redundansi:** Cek `notification_logs` sebelum kirim

### C. Pengingat Harian (Daily Check)
- **Trigger:** Scheduled tiap hari jam 07:00
- **Isi:** "Jangan lupa isi mood tracker dan cek kondisi hari ini."

### D. Bluetooth State Checker
- Saat buka modal "Koneksi Gelang", app mengecek apakah Bluetooth HP aktif
- **BT OFF:** Tampil pesan "Bluetooth Tidak Aktif" + polling setiap 2 detik
- **BT ON:** Auto-scan langsung
- **Web (HTTP):** Hardcoded 'on' karena Web Bluetooth API butuh HTTPS

---

## 6. Manajemen Retensi Data (Cache Cleanup)
Untuk mencegah ukuran database SQLite membesar secara eksponensial di perangkat smartphone:
1. **Aturan Retensi:** Data pada tabel `feature_vectors` yang berumur **lebih dari 90 hari** akan dihapus secara otomatis setiap kali aplikasi diaktifkan pertama kali di hari tersebut.
2. **Estimasi Penyimpanan:** Penggunaan data selama 1 minggu menghasilkan sekitar **~11.54 MB** (40.320 baris data). Dengan retensi 90 hari, database hanya akan menggunakan memori berkisar **~150 MB** di dalam penyimpanan HP pengguna.

---

## 7. Roadmap Fitur (Client Requirements)

Berdasarkan hasil diskusi dengan klien, berikut adalah roadmap pengembangan 5 fitur tambahan beserta status dan prioritasnya:

| Prioritas | Fitur | Status | Dependency |
|:---:|:---|:---:|:---|
| 🔴 Tinggi | **Keamanan Data** — Layar kunci PIN & Biometrik | `[x] Done` | PIN screen implemented, biometrik planned |
| 🔴 Tinggi | **Mood Tracker** — Input mood harian + grafik detail di Tren | `[ ] Planned` | SQLite (tabel `mood_logs`) |
| 🟡 Sedang | **Edukasi** — Konten artikel gejala & pertolongan pertama per fase | `[x] Done` | `educationContent.ts` (bundled, 3 artikel) |
| 🟡 Sedang | **Notifikasi & Reminder** — Phase summary + pengingat obat/olahraga | `[x] Done` | `expo-notifications`, `notificationService.ts` |
| 🟢 Rendah | **Gamifikasi** — Poin, badge, & reward sistem kepatuhan | `[ ] Planned` | ⚠️ Tunggu klarifikasi klien |

### Catatan Gamifikasi
> **Open Question untuk Klien:** Apakah *"unlock feature"* yang dimaksud adalah fitur yang benar-benar terkunci (memerlukan poin untuk membuka akses), atau hanya berupa **visual reward** (badge, level) tanpa memblokir fitur apapun? Jawaban ini sangat menentukan arsitektur dan estimasi waktu pengerjaan.

### Trigger Poin Gamifikasi (Rencana Awal)
| Aksi Pengguna | Poin |
|:---|:---:|
| Buka aplikasi hari ini (streak) | +10 |
| Input mood harian | +15 |
| Baca 1 artikel edukasi | +20 |
| Gelang terhubung (BLE aktif) | +5 |
| Streak 7 hari berturut-turut | +50 (bonus) |

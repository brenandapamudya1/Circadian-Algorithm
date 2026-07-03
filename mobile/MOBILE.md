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
| **Desain Antarmuka** | Tailwind CSS / NativeWind | Styling konsisten dengan visual premium dan fleksibel. |

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

    subgraph Mobile App (Android & iOS)
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

---

## 4. Struktur Folder Project (React Native Tree)

Kerangka proyek di bawah direktori `mobile/` ditata secara modular untuk memisahkan logika UI, BLE, Database, dan Algoritma Sirkadian (Porting dari Python):

```
mobile/
│
├── MOBILE.md                    ← Dokumen ini
├── package.json
├── tsconfig.json
├── App.tsx                      ← Entrypoint aplikasi
│
├── src/
│   ├── assets/                  ← Aset gambar, ikon, dan font
│   │
│   ├── components/              ← UI reusable (buttons, cards, charts)
│   │   ├── BleDeviceCard.tsx
│   │   ├── MetricChart.tsx
│   │   └── StatusIndicator.tsx
│   │
│   ├── database/                ← Pengelolaan SQLite
│   │   ├── sqlite.ts            ← Inisialisasi DB & Eksekusi Query
│   │   └── queries.ts           ← CRUD untuk baselines & feature_vectors
│   │
│   ├── services/                ← Background service & BLE
│   │   ├── bleManager.ts        ← Logika Scan, Connect, dan Listen BLE
│   │   └── syncService.ts       ← Pengumpul data & buffer BLE ke SQLite
│   │
│   ├── circadian/               ← Porting Logika Python ➡️ TypeScript
│   │   ├── windowClassifier.ts  ← Menentukan window biologis berdasarkan jam lokal HP
│   │   ├── baselineManager.ts   ← Penerapan EMA (alpha=0.1) harian pada database
│   │   ├── normalizer.ts        ← Perhitungan z-score instan
│   │   ├── gatingRules.ts       ← Logika rules GR-01 s/d GR-05
│   │   └── pipeline.ts          ← Orkestrator sirkadian lokal di mobile
│   │
│   ├── store/                   ← State management (Zustand)
│   │   └── useBleStore.ts       ← Global state untuk status koneksi sensor
│   │
│   └── views/                   ← Halaman aplikasi utama
│       ├── HomeScreen.tsx       ← Visualisasi status real-time & grafik
│       ├── SettingsScreen.tsx   ← Pengaturan profil & kalibrasi ulang
│       └── HistoryScreen.tsx    ← Riwayat log sirkadian
```

---

## 5. Manajemen Retensi Data (Cache Cleanup)
Untuk mencegah ukuran database SQLite membesar secara eksponensial di perangkat smartphone:
1. **Aturan Retensi:** Data pada tabel `feature_vectors` yang berumur **lebih dari 90 hari** akan dihapus secara otomatis setiap kali aplikasi diaktifkan pertama kali di hari tersebut.
2. **Estimasi Penyimpanan:** Penggunaan data selama 1 minggu menghasilkan sekitar **~11.54 MB** (40.320 baris data). Dengan retensi 90 hari, database hanya akan menggunakan memori berkisar **~150 MB** di dalam penyimpanan HP pengguna.

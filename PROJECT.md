# BIPOLYZER — Circadian Algorithm (Software Layer)

## Overview

BIPOLYZER Circadian Algorithm adalah komponen software inti dari sistem
wearable deteksi dini fase bipolar. Modul ini berperan sebagai **lapisan
filter kontekstual** yang memvalidasi data multimodal dari tiga sensor
(MAX30102, INMP441, MPU6050) berdasarkan jam biologis pengguna sebelum
data diteruskan ke model klasifikasi fase mood.

Tanpa filter ini, sistem akan menghasilkan false positive tinggi — misalnya
membaca tidur siang sebagai fase depresi, atau olahraga pagi sebagai fase
manik.

---

## Objectives

1. Menerima data mentah multimodal dari sensor (HRV, vokal, akselerasi)
   beserta timestamp-nya
2. Mengelompokkan data ke dalam **time-window biologis** (morning / afternoon
   / evening / nocturnal)
3. Menghitung baseline personal per window waktu untuk setiap pengguna
4. Mendeteksi anomali yang valid secara kontekstual (bukan sekadar noise
   harian)
5. Menghasilkan **Circadian-Validated Feature Vector** yang siap digunakan
   model klasifikasi downstream

---

## Tech Stack

| Layer            | Teknologi                          | Alasan                                      |
|------------------|------------------------------------|---------------------------------------------|
| Bahasa utama     | Python 3.11                        | Ekosistem ML/signal processing terlengkap   |
| Data processing  | NumPy, Pandas                      | Manipulasi time-series dan windowing        |
| Signal filtering | SciPy                              | Bandpass filter, detrending sinyal HRV      |
| Feature extract  | librosa (vokal), neurokit2 (HRV)   | Library spesifik domain                     |
| ML / Baseline    | scikit-learn                       | Gaussian baseline modeling per window       |
| Serialisasi      | JSON / Parquet                     | Output feature vector ke downstream model  |
| Testing          | pytest                             | Unit test per modul                         |
| Visualisasi dev  | matplotlib, seaborn                | Debug dan validasi pola sirkadian           |
| Logging          | Python logging (structured)        | Audit trail tiap decision filter            |
| **Mobile App**   | React Native (Expo) + TypeScript   | Aplikasi lintas platform (Android/iOS)      |
| **Mobile Storage**| SQLite (expo-sqlite)              | Penyimpanan lokal standalone tanpa internet |
| **Mobile Comm**  | react-native-ble-plx               | Komunikasi BLE hemat daya dengan ESP32      |

---

## Circadian Window Definition

```
00:00 – 05:59  →  NOCTURNAL    (baseline tidur, parasimpatis dominan)
06:00 – 11:59  →  MORNING      (aktivasi simpatis, pitch naik natural)
12:00 – 16:59  →  AFTERNOON    (aktivitas puncak, HRV bervariasi tinggi)
17:00 – 21:59  →  EVENING      (transisi, penurunan pitch natural)
22:00 – 23:59  →  PRE-SLEEP    (wind-down, HRV mulai naik)
```

Setiap window memiliki **threshold adaptif** yang dihitung dari baseline
personal pengguna selama 7–14 hari pertama (calibration phase).

---

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SENSOR LAYER                             │
│   MAX30102 (HRV/PPG)  ·  INMP441 (Vocal)  ·  MPU6050 (IMU)    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  raw multimodal data + timestamp
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER                             │
│   · Parse & validate incoming data stream                       │
│   · Attach UTC timestamp + local biological clock offset        │
│   · Buffer sliding window (30-second epochs)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PREPROCESSING LAYER                            │
│   HRV   : bandpass filter → RR interval extraction → RMSSD     │
│   Vocal : framing → FFT → F0/pitch, speech rate, pause detect  │
│   IMU   : low-pass filter → activity segmentation → dwell time │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               CIRCADIAN WINDOW CLASSIFIER                       │
│   · Map timestamp → biological window (NOCTURNAL/MORNING/...)  │
│   · Load user's personal baseline for that window              │
│   · Apply window-specific normalization                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ANOMALY VALIDATOR                               │
│   · Compute z-score deviation from personal baseline           │
│   · Apply contextual gating rules:                             │
│       - Is user in expected sleep window? → suppress IMU flag  │
│       - Is pitch elevation during exercise window? → suppress  │
│       - Is RMSSD drop post-meal? → suppress                    │
│   · Only pass anomalies that survive ALL gating rules          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 FEATURE VECTOR BUILDER                          │
│   Output per epoch:                                             │
│   {                                                             │
│     "timestamp": ...,                                           │
│     "window": "MORNING",                                        │
│     "hrv": { "rmssd": ..., "sdnn": ..., "zscore": ... },      │
│     "vocal": { "f0": ..., "speech_rate": ..., "zscore": ... }, │
│     "imu": { "dwell_min": ..., "transitions": ..., "zscore":...}│
│     "circadian_valid": true/false,                              │
│     "suppressed_reason": null / "exercise_window" / ...        │
│   }                                                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             DOWNSTREAM: MOOD PHASE CLASSIFIER                   │
│         (model ML — di luar scope modul ini)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
bipolyzer-circadian/
│
├── PROJECT.md                  ← dokumen ini
├── AGENT.md                    ← panduan agent
├── README.md                   ← quick start
├── requirements.txt
├── .env.example                ← konfigurasi environment
│
├── mobile/                     ← React Native mobile application
│   ├── MOBILE.md               ← arsitektur & panduan mobile app
│   └── ...
│
├── config/
│   ├── circadian_windows.yaml  ← definisi window biologis & threshold
│   ├── gating_rules.yaml       ← aturan contextual gating
│   └── user_profile.yaml       ← template profil baseline pengguna
│
├── src/
│   ├── __init__.py
│   │
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── parser.py           ← parse raw sensor payload
│   │   ├── validator.py        ← validasi schema & range sensor
│   │   └── buffer.py           ← sliding window buffer (30s epoch)
│   │
│   ├── preprocessing/
│   │   ├── __init__.py
│   │   ├── hrv.py              ← PPG → RR interval → RMSSD, SDNN
│   │   ├── vocal.py            ← audio → F0, speech rate, pause duration
│   │   └── imu.py              ← accelero/gyro → activity segmentation
│   │
│   ├── circadian/
│   │   ├── __init__.py
│   │   ├── window_classifier.py   ← timestamp → biological window
│   │   ├── baseline_manager.py    ← simpan & update baseline personal
│   │   └── normalizer.py          ← normalisasi per-window
│   │
│   ├── anomaly/
│   │   ├── __init__.py
│   │   ├── detector.py         ← z-score deviation detector
│   │   └── gating.py           ← contextual gating rules engine
│   │
│   ├── features/
│   │   ├── __init__.py
│   │   └── vector_builder.py   ← assemble final feature vector
│   │
│   └── pipeline.py             ← orchestrator: jalankan full pipeline
│
├── data/
│   ├── raw/                    ← sample raw sensor data (untuk dev/test)
│   ├── baselines/              ← stored baseline per user (JSON)
│   └── output/                 ← feature vectors output
│
├── tests/
│   ├── __init__.py
│   ├── test_ingestion.py
│   ├── test_preprocessing.py
│   ├── test_circadian.py
│   ├── test_anomaly.py
│   └── test_pipeline.py
│
├── notebooks/
│   ├── 01_explore_hrv_windows.ipynb
│   ├── 02_vocal_baseline_analysis.ipynb
│   └── 03_circadian_filter_validation.ipynb
│
└── docs/
    ├── circadian_logic.md      ← penjelasan logika filter sirkadian
    ├── gating_rules.md         ← dokumentasi tiap gating rule
    └── api_reference.md        ← dokumentasi fungsi publik
```

---

## Calibration Phase

Sebelum filter aktif penuh, sistem memerlukan **7–14 hari data awal**
untuk membangun baseline personal per pengguna per window waktu.

Selama fase ini:
- Data tetap dikumpulkan dan disimpan
- Filter sirkadian berjalan dalam mode **permissive** (tidak suppress apapun)
- Setiap hari, baseline diperbarui secara incremental (rolling update)
- Setelah hari ke-7, mode beralih ke **strict** secara otomatis

---

## Key Metrics (Success Criteria)

| Metrik                         | Target          |
|--------------------------------|-----------------|
| False positive rate            | < 15%           |
| Anomali yang lolos gating      | Sensitivitas ≥ 85% terhadap episode klinis |
| Latency per epoch (pipeline)   | < 500 ms        |
| Baseline update frequency      | Setiap 24 jam (rolling) |
| Minimum data untuk kalibrasi   | 7 hari          |
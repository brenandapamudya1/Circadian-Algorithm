# Next Feature: ESP32 Payload Upgrade

> **Update 21 Aug 2026:** Lihat juga `REVISI_UI_UX.md` untuk rencana revisi UI/UX berdasarkan feedback dokter.

Dokumen ini mencatat rencana pengembangan berikutnya untuk sinkronisasi penuh antara ESP32 dan Mobile App.

---

## Status Saat Ini (jam3.ino)

Payload BLE yang dikirim ESP32 saat ini:
```json
{
  "uid": "user_001",
  "bat": 85,
  "acc": [0.12, -0.45, 9.78],
  "gyr": [0.02, -0.01, 0.03],
  "bpm": 72,
  "rr": [850, 860, 845],
  "aRms": 0.0234,
  "aZcr": 142
}
```

### Yang Sudah Sinkron
| Field | ESP32 | App | Status |
|:---|:---:|:---:|:---|
| `uid` | ✅ | ✅ | Match |
| `acc` | ✅ | ✅ | Match (accelerometer) |
| `bpm` | ✅ | ✅ | Match (heart rate) |
| `rr` | ✅ | ✅ | Match (RR intervals) |
| `aRms` | ✅ | ✅ | Match (audio RMS) |
| `bat` | ✅ | ❌ | App tidak parse (bonus data) |

### Yang Belum Sinkron
| Field | ESP32 | App | Status |
|:---|:---:|:---:|:---|
| `gyr` | ✅ | ✅ (optional) | Match — ESP kirim, app fallback jika kosong |
| `aZcr` | ✅ | ✅ (optional) | Match — ESP kirim, app fallback jika kosong |

---

## Rencana: Update ESP32 (Option A)

### 1. Tambah Gyroscope Data (`gyr`)

ESP32 sudah memiliki MPU6050 yang membaca accelerometer + gyroscope.
Saat ini gyroscope sudah dibaca di `readMPU()` tapi **tidak dikirim via BLE**.

**Yang perlu diubah di jam3.ino:**

```cpp
// Variabel global (sudah ada)
float lastGyrX = 0, lastGyrY = 0, lastGyrZ = 0;

// Di bagian EPOCH REPORT BLE payload:
// TAMBAHKAN gyr ke JSON payload
char blePayload[550];
snprintf(blePayload, sizeof(blePayload),
    "{\"uid\":\"%s\",\"bat\":%d,\"acc\":[%.2f,%.2f,%.2f],\"gyr\":[%.2f,%.2f,%.2f],\"bpm\":%.0f,\"rr\":%s,\"aRms\":%.4f,\"aZcr\":%d}",
    USER_ID, currentBattPercent, 
    lastAccX, lastAccY, lastAccZ,           // acc
    lastGyrX, lastGyrY, lastGyrZ,           // gyr ← TAMBAHAN
    currentBPM, rrJson, avgRms,
    audioZcrAccum / max(1, audioFrameCount)  // aZcr ← TAMBAHAN
);
```

### 2. Tambah Audio Zero Crossing Rate (`aZcr`)

ESP32 sudah menghitung `audioZcrAccum` dan `audioFrameCount` di loop, tapi tidak dikirim.

**Yang perlu dikirim:**
```
aZcr = audioZcrAccum / audioFrameCount   // average ZCR per epoch
```

### 3. Tambah Battery (`bat`) ke App

App perlu parse field `bat` untuk menampilkan battery level di UI.

---

## Payload Target (Setelah Update)

```json
{
  "uid": "user_001",
  "bat": 85,
  "acc": [0.12, -0.45, 9.78],
  "gyr": [0.02, -0.01, 0.03],
  "bpm": 72,
  "rr": [850, 860, 845],
  "aRms": 0.0234,
  "aZcr": 142
}
```

---

## Dampak ke Pipeline App

| Biomarker | Sebelum (hardcode) | Sesudah (real data) |
|:---|:---|:---|
| **HRV (RMSSD)** | ✅ Real dari `rr` | ✅ Tetap real |
| **Vocal F0** | ⚠️ Hardcode 150.0 | ✅ Real dari `aZcr` |
| **IMU Dwell** | ⚠️ Hardcode 0.5 (diam) | ✅ Real dari `gyr` |
| **Battery** | ⚠️ Tidak ditampilkan | ✅ Real dari `bat` |

---

## Perubahan yang Diperlukan

### ESP32 (jam3.ino)
- [x] Tambah `gyr` ke BLE JSON payload
- [x] Tambah `aZcr` ke BLE JSON payload
- [x] Naikkan buffer `blePayload` ke 600 bytes

### Mobile App
- [x] Interface `RawSensorData` sudah support optional `gyr` & `aZcr`
- [x] Pipeline fallback ke accelerometer jika `gyr` tidak ada
- [ ] Parse `bat` untuk tampilkan battery level di UI (future)
- [ ] Update mock data simulator di bleManager.ts (future)

---

## Catatan Implementasi

- **Prioritas:** Rendah (untuk development berikutnya)
- **Estimasi effort:** 1-2 jam untuk ESP32 + App
- **Risk:** Low — perubahan backward-compatible (app tetap jalan dengan payload lama)

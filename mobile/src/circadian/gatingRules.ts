import { NormalizedEpochPayload } from './normalizer';

export interface AnomalyFlags {
  hrv_anomaly: boolean;
  vocal_anomaly: boolean;
  imu_anomaly: boolean;
}

export interface GatedResult {
  circadian_valid: boolean; // true = aman/normal/suppressed, false = anomali valid (butuh alert)
  suppressed_reason: string | null; // nama rule yang mensupres anomali
  anomaly_flags: AnomalyFlags;
}

export const ZSCORE_THRESHOLD = 2.0;

/**
 * Mendeteksi anomali pada masing-masing domain (HRV, Vocal, IMU)
 * berdasarkan threshold z-score.
 */
export function detectAnomalies(
  epoch: NormalizedEpochPayload,
  threshold: number = ZSCORE_THRESHOLD
): AnomalyFlags {
  return {
    hrv_anomaly: Math.abs(epoch.hrv_normalized.zscore) > threshold,
    vocal_anomaly: Math.abs(epoch.vocal_normalized.zscore) > threshold,
    imu_anomaly: Math.abs(epoch.imu_normalized.zscore) > threshold,
  };
}

/**
 * Menerapkan Aturan Gating (Gating Rules) untuk membedakan anomali biologis alami
 * dari anomali patologis (potensi relaps bipolar).
 * 
 * Aturan:
 *   - GR-01: Suppress IMU anomali pada window tidur (NOCTURNAL).
 *   - GR-02: Suppress Vocal (F0 naik) jika IMU terdeteksi aktif/olahraga (dwell = 0).
 *   - GR-03: Suppress HRV (RMSSD turun) saat AFTERNOON/EVENING karena digestion (post-meal).
 *   - GR-04: Suppress Vocal/HRV naik saat MORNING (morning activation alami).
 *   - GR-05: Bypass semua anomali jika belum melewati masa kalibrasi 7 hari.
 */
export function applyGatingRules(
  epoch: NormalizedEpochPayload,
  flags: AnomalyFlags
): GatedResult {
  const hasAnomaly = flags.hrv_anomaly || flags.vocal_anomaly || flags.imu_anomaly;

  // Jika tidak ada anomali sama sekali, data valid secara circadian
  if (!hasAnomaly) {
    return {
      circadian_valid: true,
      suppressed_reason: null,
      anomaly_flags: flags,
    };
  }

  // ── GR-05: Kalibrasi Bypass ──────────────────────────────────────────────
  if (!epoch.is_calibrated) {
    return {
      circadian_valid: true,
      suppressed_reason: 'calibration_bypass',
      anomaly_flags: flags,
    };
  }

  // ── GR-01: Sleep Window IMU ──────────────────────────────────────────────
  // Jika sedang tidur (NOCTURNAL) dan ada deteksi anomali gerak (IMU), abaikan.
  if (epoch.window === 'NOCTURNAL' && flags.imu_anomaly) {
    return {
      circadian_valid: true,
      suppressed_reason: 'sleep_window_imu',
      anomaly_flags: flags,
    };
  }

  // ── GR-02: Exercise Pitch ────────────────────────────────────────────────
  // Jika vokal anomali (nada naik/bersemangat) tapi sedang berolahraga (dwell_min = 0), abaikan.
  const f0Increased = epoch.vocal_normalized.value > epoch.vocal_normalized.baseline_mean;
  const isExercising = epoch.imu_normalized.value === 0; // 0 = active/no dwell
  if (flags.vocal_anomaly && f0Increased && isExercising) {
    return {
      circadian_valid: true,
      suppressed_reason: 'exercise_pitch',
      anomaly_flags: flags,
    };
  }

  // ── GR-03: Post-Meal HRV ─────────────────────────────────────────────────
  // Jika HRV anomali (RMSSD turun) saat siang/sore (AFTERNOON/EVENING) karena metabolisme makan, abaikan.
  const rmssdDropped = epoch.hrv_normalized.value < epoch.hrv_normalized.baseline_mean;
  if (flags.hrv_anomaly && rmssdDropped && (epoch.window === 'AFTERNOON' || epoch.window === 'EVENING')) {
    return {
      circadian_valid: true,
      suppressed_reason: 'post_meal_hrv',
      anomaly_flags: flags,
    };
  }

  // ── GR-04: Morning Activation ────────────────────────────────────────────
  // Kenaikan alami kortisol pagi hari memicu peningkatan Pitch/HR. Abaikan anomali naik di window MORNING.
  if (epoch.window === 'MORNING') {
    const hrIncreased = epoch.hrv_normalized.value > epoch.hrv_normalized.baseline_mean; // untuk proxy, kenaikan HRV/detak jantung
    const pitchIncreased = epoch.vocal_normalized.value > epoch.vocal_normalized.baseline_mean;

    if ((flags.vocal_anomaly && pitchIncreased) || (flags.hrv_anomaly && hrIncreased)) {
      return {
        circadian_valid: true,
        suppressed_reason: 'morning_activation',
        anomaly_flags: flags,
      };
    }
  }

  // Jika tidak ada aturan gating yang terpenuhi, anomali adalah VALID (Potensi Relaps/Episode)
  return {
    circadian_valid: false,
    suppressed_reason: null,
    anomaly_flags: flags,
  };
}

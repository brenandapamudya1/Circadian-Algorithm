import { getBaselineFromDb } from '../database/queries';
import { getBiologicalWindow } from './windowClassifier';

export interface RawEpochFeatures {
  timestamp: string;
  user_id: string;
  hrv: {
    rmssd: number;
  };
  vocal: {
    f0: number;
  };
  imu: {
    dwell_min: number;
  };
}

export interface NormalizedDomainFeature {
  value: number;
  baseline_mean: number;
  baseline_std: number;
  zscore: number;
}

export interface NormalizedEpochPayload {
  timestamp: string;
  user_id: string;
  window: string;
  calibration_day: number;
  is_calibrated: boolean;
  hrv_normalized: NormalizedDomainFeature;
  vocal_normalized: NormalizedDomainFeature;
  imu_normalized: NormalizedDomainFeature;
}

/**
 * Menghitung hari kalibrasi sejak tanggal kalibrasi awal.
 * Kalibrasi selesai (is_calibrated = true) setelah >= 7 hari.
 * 
 * @param currentTimestamp Timestamp saat ini (ISO 8601)
 * @param calibrationStartDateStr Tanggal mulai kalibrasi (ISO 8601, default: saat ini)
 */
export function getCalibrationInfo(
  currentTimestamp: string,
  calibrationStartDateStr?: string
): { calibrationDay: number; isCalibrated: boolean } {
  try {
    const current = new Date(currentTimestamp);
    const start = calibrationStartDateStr ? new Date(calibrationStartDateStr) : current;

    if (isNaN(current.getTime()) || isNaN(start.getTime())) {
      return { calibrationDay: 0, isCalibrated: false };
    }

    // Selisih hari bulatkan ke bawah
    const diffMs = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const calibrationDay = Math.max(0, diffDays);
    const isCalibrated = calibrationDay >= 7;

    return { calibrationDay, isCalibrated };
  } catch (error) {
    console.error('[Normalizer] Gagal kalkulasi kalibrasi:', error);
    return { calibrationDay: 0, isCalibrated: false };
  }
}

/**
 * Normalisasi fitur epoch mentah terhadap baseline personal dari database SQLite.
 * Menghitung Z-Score jika fase kalibrasi (7 hari pertama) telah terlewati.
 * 
 * @param epoch Data fitur mentah dari epoch aktif
 * @param calibrationStartDate Tanggal mulai kalibrasi user (format ISO)
 */
export async function normalizeFeatures(
  epoch: RawEpochFeatures,
  calibrationStartDate?: string
): Promise<NormalizedEpochPayload> {
  // 1. Dapatkan biological window saat ini
  const window = getBiologicalWindow(epoch.timestamp);

  // 2. Dapatkan baseline personal dari SQLite untuk window tersebut
  let baseline = await getBaselineFromDb(window);
  if (!baseline) {
    // Fallback default
    baseline = {
      window_name: window,
      hrv_rmssd_mean: 50.0,
      hrv_rmssd_std: 10.0,
      vocal_f0_mean: 150.0,
      vocal_f0_std: 20.0,
      imu_dwell_mean: 10.0,
      imu_dwell_std: 2.0,
    };
  }

  // 3. Cek status kalibrasi
  const { calibrationDay, isCalibrated } = getCalibrationInfo(epoch.timestamp, calibrationStartDate);

  // Helper normalisasi satu domain
  const normalize = (value: number, mean: number, std: number): NormalizedDomainFeature => {
    const finalStd = std === 0 ? 1.0 : std;
    // Z-Score hanya dihitung jika sudah terkalibrasi (>= 7 hari), jika belum z-score bernilai 0.0
    const zscore = isCalibrated ? (value - mean) / finalStd : 0.0;
    return {
      value,
      baseline_mean: mean,
      baseline_std: finalStd,
      zscore: parseFloat(zscore.toFixed(4)),
    };
  };

  return {
    timestamp: epoch.timestamp,
    user_id: epoch.user_id,
    window,
    calibration_day: calibrationDay,
    is_calibrated: isCalibrated,
    hrv_normalized: normalize(
      epoch.hrv.rmssd,
      baseline.hrv_rmssd_mean,
      baseline.hrv_rmssd_std
    ),
    vocal_normalized: normalize(
      epoch.vocal.f0,
      baseline.vocal_f0_mean,
      baseline.vocal_f0_std
    ),
    imu_normalized: normalize(
      epoch.imu.dwell_min,
      baseline.imu_dwell_mean,
      baseline.imu_dwell_std
    ),
  };
}

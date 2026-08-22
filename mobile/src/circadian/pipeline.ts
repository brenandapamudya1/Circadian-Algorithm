import { RawSensorData } from '../services/bleManager';
import { normalizeFeatures, RawEpochFeatures } from './normalizer';
import { detectAnomalies, applyGatingRules } from './gatingRules';
import { insertFeatureVector, DbFeatureVector } from '../database/queries';

export interface PipelineResult {
  epoch_id: string;
  timestamp: string;
  window_name: string;
  hrv_rmssd: number;
  hrv_zscore: number;
  vocal_f0: number;
  vocal_zscore: number;
  imu_dwell_min: number;
  imu_zscore: number;
  circadian_valid: boolean;
  suppressed_reason: string | null;
}

/**
 * Menghitung RMSSD (Root Mean Square of Successive Differences) dari array RR-Interval.
 * Digunakan sebagai parameter utama analisis HRV.
 */
function calculateRmssd(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) {
    return 50.0; // Fallback jika tidak ada data beat cukup dalam 30 detik
  }

  let sumDiffSq = 0;
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    const diff = rrIntervals[i + 1] - rrIntervals[i];
    sumDiffSq += diff * diff;
  }

  return Math.sqrt(sumDiffSq / (rrIntervals.length - 1));
}

/**
 * Menghitung parameter keaktifan IMU (dwell minutes).
 * 
 * Kombinasi Gyroscope & Accelerometer dengan noise thresholding yang ditingkatkan:
 * - Gyroscope (> 15.0 °/s total 3-axis): menoleransi noise drift bawaan MPU6050 saat diam
 * - Accelerometer magnitude (deviasi dari gravitasi 9.81 m/s²): memverifikasi pergerakan fisik nyata
 * 
 * Threshold Output:
 *   - High activity: dwell = 0.0 menit (olahraga/gerakan aktif)
 *   - Light activity: dwell = 0.2 menit (gerakan ringan)
 *   - Idle/rest: dwell = 0.5 menit (diam/rileks)
 */
function calculateImuDwell(
  gyr?: [number, number, number],
  acc?: [number, number, number]
): number {
  let isMovingByGyro = false;
  let isLightMovingByGyro = false;

  if (gyr) {
    const gyroSum = Math.abs(gyr[0]) + Math.abs(gyr[1]) + Math.abs(gyr[2]);
    if (gyroSum > 15.0) isMovingByGyro = true;
    else if (gyroSum > 8.0) isLightMovingByGyro = true;
  }

  let isMovingByAcc = false;
  let isLightMovingByAcc = false;

  if (acc) {
    const accMagnitude = Math.sqrt(acc[0] * acc[0] + acc[1] * acc[1] + acc[2] * acc[2]);
    const deviation = Math.abs(accMagnitude - 9.81);
    if (deviation > 2.5) isMovingByAcc = true;
    else if (deviation > 1.0) isLightMovingByAcc = true;
  }

  if (isMovingByGyro || isMovingByAcc) {
    return 0.0; // High activity
  }

  if (isLightMovingByGyro || isLightMovingByAcc) {
    return 0.2; // Light activity
  }

  return 0.5; // Idle / resting
}

/**
 * Orchestrator Utama Pipeline Sirkadian.
 * Menjalankan 5 tahapan dari penerimaan data mentah BLE hingga penyimpanan ke database:
 *   1. Preprocessing (Ekstraksi RMSSD, F0 proxy, dan Dwell time)
 *   2. Normalization (Pencarian baseline window, z-score, & cek kalibrasi)
 *   3. Anomaly Detection (Pemeriksaan threshold z-score > 2.0)
 *   4. Gating (Pemberlakuan aturan GR-01 s/d GR-05)
 *   5. SQLite Save (Penyimpanan permanen riwayat deteksi)
 * 
 * @param rawData Data mentah yang masuk dari BLE/Simulator
 * @param calibrationStartDate Tanggal mulai kalibrasi user (ISO format, default: hari ini)
 */
export async function runCircadianPipeline(
  rawData: RawSensorData,
  calibrationStartDate?: string
): Promise<PipelineResult> {
  const timestamp = new Date().toISOString();
  const epochId = `epoch_${Date.now()}`;

  // ── TAHAP 1: PREPROCESSING ────────────────────────────────────────────────
  const hrvRmssd = calculateRmssd(rawData.rr);
  // aZcr (Zero Crossing Rate) digunakan sebagai proxy vokal F0.
  // Sanitasi rentang fisiologis: suara percakapan manusia berada di rentang 80 Hz - 300 Hz.
  // Jika di luar rentang (seperti saat hening / aZcr rendah), fallback ke 150.0 Hz.
  const rawZcr = rawData.aZcr ?? 0;
  const isHumanVoice = rawZcr >= 80 && rawZcr <= 300;
  const vocalF0 = isHumanVoice ? rawZcr : 150.0;

  // IMU dwell: kombinasi gyro (noise filtered) & accelerometer
  const imuDwell = calculateImuDwell(rawData.gyr, rawData.acc);

  const preprocessed: RawEpochFeatures = {
    timestamp,
    user_id: rawData.uid || 'local_user',
    hrv: { rmssd: hrvRmssd },
    vocal: { f0: vocalF0 },
    imu: { dwell_min: imuDwell },
  };

  // ── TAHAP 2: NORMALIZATION ────────────────────────────────────────────────
  const normalized = await normalizeFeatures(preprocessed, calibrationStartDate);

  // ── TAHAP 3 & 4: ANOMALY & GATING ─────────────────────────────────────────
  const anomalyFlags = detectAnomalies(normalized);
  const gatedResult = applyGatingRules(normalized, anomalyFlags);

  // ── TAHAP 5: SQLITE SAVE ──────────────────────────────────────────────────
  const dbVector: DbFeatureVector = {
    epoch_id: epochId,
    timestamp: timestamp,
    window_name: normalized.window,
    hrv_rmssd: hrvRmssd,
    hrv_zscore: normalized.hrv_normalized.zscore,
    vocal_f0: vocalF0,
    vocal_zscore: normalized.vocal_normalized.zscore,
    imu_dwell_min: imuDwell,
    imu_zscore: normalized.imu_normalized.zscore,
    circadian_valid: gatedResult.circadian_valid ? 1 : 0,
    suppressed_reason: gatedResult.suppressed_reason,
  };

  await insertFeatureVector(dbVector);

  return {
    epoch_id: epochId,
    timestamp,
    window_name: normalized.window,
    hrv_rmssd: hrvRmssd,
    hrv_zscore: normalized.hrv_normalized.zscore,
    vocal_f0: vocalF0,
    vocal_zscore: normalized.vocal_normalized.zscore,
    imu_dwell_min: imuDwell,
    imu_zscore: normalized.imu_normalized.zscore,
    circadian_valid: gatedResult.circadian_valid,
    suppressed_reason: gatedResult.suppressed_reason,
  };
}

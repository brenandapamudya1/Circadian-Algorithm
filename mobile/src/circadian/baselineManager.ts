import { getBaselineFromDb, updateBaselineInDb, DbBaseline } from '../database/queries';

export const EMA_ALPHA = 0.1; // Default alpha dari config/gating_rules.yaml

export interface NewFeaturesInput {
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

/**
 * Memperbarui baseline personal pengguna menggunakan Exponential Moving Average (EMA).
 * Data baru yang dihitung langsung disimpan kembali ke database SQLite.
 * 
 * Formula:
 *   new_mean = (alpha * new_value) + ((1 - alpha) * old_mean)
 *   new_var  = (alpha * (new_value - old_mean)^2) + ((1 - alpha) * old_var)
 *   new_std  = sqrt(new_var)
 * 
 * @param windowName Nama biological window (contoh: "MORNING")
 * @param newFeatures Data fitur baru dari epoch harian
 * @param alpha Parameter bobot pembaruan EMA (default: 0.1)
 */
export async function updatePersonalBaseline(
  windowName: string,
  newFeatures: NewFeaturesInput,
  alpha: number = EMA_ALPHA
): Promise<DbBaseline> {
  // 1. Ambil baseline saat ini dari SQLite
  let currentBaseline = await getBaselineFromDb(windowName);

  // Fallback default jika tidak ditemukan (seharusnya sudah ada dari seed)
  if (!currentBaseline) {
    currentBaseline = {
      window_name: windowName,
      hrv_rmssd_mean: 50.0,
      hrv_rmssd_std: 10.0,
      vocal_f0_mean: 150.0,
      vocal_f0_std: 20.0,
      imu_dwell_mean: 10.0,
      imu_dwell_std: 2.0,
    };
  }

  // Helper untuk hitung EMA satu parameter
  const calculateEma = (newVal: number, oldMean: number, oldStd: number) => {
    const oldVar = oldStd ** 2;
    const newMean = alpha * newVal + (1 - alpha) * oldMean;
    const newVar = alpha * (newVal - oldMean) ** 2 + (1 - alpha) * oldVar;
    // Hindari standar deviasi bernilai 0
    const newStd = Math.max(0.01, Math.sqrt(newVar));
    return { mean: newMean, std: newStd };
  };

  // 2. Hitung nilai EMA baru untuk masing-masing domain
  const hrvResult = calculateEma(
    newFeatures.hrv.rmssd,
    currentBaseline.hrv_rmssd_mean,
    currentBaseline.hrv_rmssd_std
  );

  const vocalResult = calculateEma(
    newFeatures.vocal.f0,
    currentBaseline.vocal_f0_mean,
    currentBaseline.vocal_f0_std
  );

  const imuResult = calculateEma(
    newFeatures.imu.dwell_min,
    currentBaseline.imu_dwell_mean,
    currentBaseline.imu_dwell_std
  );

  // 3. Simpan baseline ter-update ke SQLite
  await updateBaselineInDb(
    windowName,
    hrvResult.mean,
    hrvResult.std,
    vocalResult.mean,
    vocalResult.std,
    imuResult.mean,
    imuResult.std
  );

  return {
    window_name: windowName,
    hrv_rmssd_mean: hrvResult.mean,
    hrv_rmssd_std: hrvResult.std,
    vocal_f0_mean: vocalResult.mean,
    vocal_f0_std: vocalResult.std,
    imu_dwell_mean: imuResult.mean,
    imu_dwell_std: imuResult.std,
  };
}

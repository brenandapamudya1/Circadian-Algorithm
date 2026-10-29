import { Platform } from 'react-native';
import { getAllFeatureVectors, getUsername, DbFeatureVector } from '../database/queries';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format timestamp ISO ke format dataset: "DD MMM YYYY, HH.mm"
 * Contoh: "09 Sep 2026, 06.00"
 */
export function formatTimestampForExport(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}.${minutes}`;
  } catch {
    return isoString;
  }
}

/**
 * Map nama window biologis ke label Window dataset (MORNING, AFTERNOON, EVENING, SLEEP)
 */
function mapWindow(windowName: string): string {
  const upper = (windowName || '').toUpperCase();
  if (upper === 'NOCTURNAL' || upper === 'PRE-SLEEP' || upper === 'NIGHT') {
    return 'SLEEP';
  }
  return upper || 'MORNING';
}

/**
 * Mengambil atau memperkirakan Signal Vector Magnitude IMU (g)
 */
function getImuSvm(fv: DbFeatureVector): string {
  if (fv.imu_svm_g != null) {
    return fv.imu_svm_g.toFixed(3);
  }
  const dwell = fv.imu_dwell_min ?? 0.35;
  if (dwell <= 0.05) return '1.520';
  if (dwell <= 0.15) return '1.340';
  if (dwell <= 0.25) return '1.180';
  return '1.045';
}

/**
 * Map suppressed reason ke Confounder_Scenario dataset
 */
function mapConfounder(suppressedReason: string | null): string {
  if (!suppressedReason || suppressedReason === '-' || suppressedReason === 'None') {
    return 'None';
  }
  const reason = suppressedReason.toLowerCase();
  if (reason.includes('activity') || reason.includes('exercise')) {
    return 'Physical_Activity';
  }
  if (reason.includes('sleep') || reason.includes('nocturnal')) {
    return 'Normal_Sleep';
  }
  if (reason.includes('calibration') || reason.includes('baseline')) {
    return 'Baseline_Reference';
  }
  return 'None';
}

/**
 * Prediksi label fase untuk baris dataset (Stabil, Risiko Manik, Risiko Depresi)
 */
function classifyPhase(fv: DbFeatureVector): string {
  const vocalZ = fv.vocal_zscore ?? 0;
  const imuZ = fv.imu_zscore ?? 0;
  const hrvZ = fv.hrv_zscore ?? 0;

  if (vocalZ > 1.5 || (imuZ < -1.5 && hrvZ < -1.5)) {
    return 'Risiko Manik';
  }
  if (vocalZ < -1.0 || (imuZ > 1.5 && hrvZ < -1.0)) {
    return 'Risiko Depresi';
  }
  return 'Stabil';
}

/**
 * Mengonversi array feature vector dari SQLite ke format CSV 15 Kolom
 * identik dengan sheet HRV_XGBoost_Dataset_3000
 */
export function exportFeatureVectorsToCsv(
  vectors: DbFeatureVector[],
  subjectId: string = 'S1_Anonim'
): string {
  const headers = [
    'Epoch_ID',
    'Subject_ID',
    'Timestamp',
    'Window',
    'HRV_RMSSD_ms',
    'HRV_Z_Score',
    'Vocal_F0_Hz',
    'Vocal_Z_Score',
    'IMU_SVM_g',
    'IMU_Dwell_min',
    'IMU_Z_Score',
    'Circadian_Valid',
    'Suppressed',
    'Confounder_Scenario',
    'Phase_Label',
  ];

  const rows = vectors.map((fv) => {
    const epochId = fv.epoch_id;
    const subjId = subjectId;
    const formattedTs = `"${formatTimestampForExport(fv.timestamp)}"`;
    const window = mapWindow(fv.window_name);
    const hrvRmssd = fv.hrv_rmssd != null ? fv.hrv_rmssd.toFixed(2) : '48.50';
    const hrvZ = fv.hrv_zscore != null ? fv.hrv_zscore.toFixed(3) : '0.000';
    const vocalF0 = fv.vocal_f0 != null ? fv.vocal_f0.toFixed(2) : '155.00';
    const vocalZ = fv.vocal_zscore != null ? fv.vocal_zscore.toFixed(3) : '0.000';
    const imuSvm = getImuSvm(fv);
    const imuDwell = fv.imu_dwell_min != null ? fv.imu_dwell_min.toFixed(3) : '0.330';
    const imuZ = fv.imu_zscore != null ? fv.imu_zscore.toFixed(3) : '0.000';
    const circadianValid = fv.circadian_valid === 1 ? 'Ya' : 'Tidak';
    const suppressed = fv.suppressed_reason && fv.suppressed_reason !== 'None' ? fv.suppressed_reason : '-';
    const confounder = mapConfounder(fv.suppressed_reason);
    const phaseLabel = classifyPhase(fv);

    return [
      epochId,
      subjId,
      formattedTs,
      window,
      hrvRmssd,
      hrvZ,
      vocalF0,
      vocalZ,
      imuSvm,
      imuDwell,
      imuZ,
      circadianValid,
      suppressed,
      confounder,
      phaseLabel,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Menyimpan dan memicu download/share file CSV pada Web dan Native Mobile
 */
export async function downloadCsvFile(
  csvContent: string,
  fileName: string = 'HRV_XGBoost_Dataset.csv'
): Promise<{ success: boolean; message: string }> {
  // Prepend UTF-8 BOM (\uFEFF) agar Microsoft Excel otomatis membaca encoding UTF-8 & pemisah koma dengan benar
  const fullContent = '\uFEFF' + csvContent;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true, message: `File ${fileName} berhasil diunduh.` };
    } catch (err: any) {
      console.error('[ExportService] Error web download:', err);
      return { success: false, message: err?.message || 'Gagal mengunduh file pada web browser.' };
    }
  } else {
    try {
      // Native Mobile (Android & iOS)
      let FileSystem: any;
      try {
        FileSystem = require('expo-file-system/legacy');
      } catch {
        FileSystem = require('expo-file-system');
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const targetUri = `${baseDir}${fileName}`;

      await FileSystem.writeAsStringAsync(targetUri, fullContent, {
        encoding: FileSystem.EncodingType?.UTF8 || 'utf8',
      });

      let isShared = false;
      try {
        const Sharing = require('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(targetUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Unduh Dataset BIPOLYZER (.csv)',
            UTI: 'public.comma-separated-values-text',
          });
          isShared = true;
        }
      } catch (_) {
        // Fallback to React Native Share
      }

      if (!isShared) {
        const { Share } = require('react-native');
        await Share.share({
          title: fileName,
          url: targetUri,
          message: `Ekspor dataset BIPOLYZER: ${fileName}`,
        });
      }

      return { success: true, message: `File ${fileName} berhasil diekspor.` };
    } catch (err: any) {
      console.error('[ExportService] Error native export:', err);
      return { success: false, message: err?.message || 'Gagal mengekspor file di perangkat.' };
    }
  }
}

/**
 * Ekspor seluruh data rekaman SQLite lokal pengguna ke file .csv
 * Format 15 kolom identik dengan sheet HRV_XGBoost_Dataset_3000
 */
export async function exportRecordedDataToCsv(): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const vectors = await getAllFeatureVectors();
    if (vectors.length === 0) {
      return {
        success: false,
        message: 'Belum ada data epoch sirkadian yang tersimpan di perangkat.',
        count: 0,
      };
    }

    const username = (await getUsername()) || 'S1_Anonim';
    const csvString = exportFeatureVectorsToCsv(vectors, username);
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `BIPOLYZER_Dataset_${username}_${dateStamp}.csv`;

    const result = await downloadCsvFile(csvString, fileName);
    return {
      success: result.success,
      message: result.message,
      count: vectors.length,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Terjadi kesalahan saat mengekspor data rekaman.',
      count: 0,
    };
  }
}

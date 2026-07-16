import { bleManager, RawSensorData } from './bleManager';
import { initDatabase } from '../database/sqlite';
import { runCircadianPipeline, PipelineResult } from '../circadian/pipeline';
import { cleanupOldFeatureVectors } from '../database/queries';

export type PipelineResultCallback = (result: PipelineResult) => void;

class BipolyzerSyncService {
  private isInitialized = false;
  private pipelineListeners: Set<PipelineResultCallback> = new Set();
  private calibrationStartDate: string | undefined;

  /**
   * Menginisialisasi database dan mulai mendengarkan (subscribe) aliran data BLE.
   */
  public async initialize(calibrationStartDate?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.calibrationStartDate = calibrationStartDate;

    try {
      // 1. Pastikan SQLite database siap
      await initDatabase();
      console.log('[SyncService] Database SQLite berhasil diinisialisasi.');

      // 2. Berlangganan ke data mentah BLE
      bleManager.subscribeRawData(async (rawData: RawSensorData) => {
        console.log('[SyncService] Menerima data BLE mentah, menjalankan pipeline sirkadian...');
        try {
          // Jalankan pipeline sirkadian end-to-end
          const result = await runCircadianPipeline(rawData, this.calibrationStartDate);
          
          console.log('[SyncService] Pipeline selesai. Hasil:', result.circadian_valid ? 'Valid (Normal/Suppressed)' : 'Anomali Terdeteksi (Episode)');

          // Pemicu siaran ke semua listener UI
          this.pipelineListeners.forEach((cb) => cb(result));

        } catch (error) {
          console.error('[SyncService] Gagal menjalankan pipeline sirkadian:', error);
        }
      });

      // 3. Jalankan pembersihan cache data lama (> 90 hari) secara berkala
      this.runPeriodicCleanup();

      this.isInitialized = true;
      console.log('[SyncService] Berhasil terhubung dengan BLE manager.');
    } catch (error) {
      console.error('[SyncService] Inisialisasi SyncService gagal:', error);
    }
  }

  /**
   * Mengatur ulang tanggal mulai kalibrasi secara dinamis.
   */
  public setCalibrationStartDate(dateStr: string): void {
    this.calibrationStartDate = dateStr;
  }

  /**
   * Berlangganan hasil kalkulasi pipeline sirkadian untuk di-update ke UI secara real-time.
   */
  public subscribePipelineResult(callback: PipelineResultCallback): () => void {
    this.pipelineListeners.add(callback);
    return () => {
      this.pipelineListeners.delete(callback);
    };
  }

  /**
   * Menghapus data riwayat yang berumur lebih dari 90 hari setiap kali aplikasi dibuka.
   */
  private async runPeriodicCleanup() {
    try {
      const deletedCount = await cleanupOldFeatureVectors(90);
      if (deletedCount > 0) {
        console.log(`[SyncService] Berhasil membersihkan ${deletedCount} feature vectors usang (> 90 hari).`);
      }
    } catch (e) {
      console.error('[SyncService] Gagal membersihkan data usang:', e);
    }
  }
}

// Export singleton instance
export const syncService = new BipolyzerSyncService();

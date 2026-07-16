import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Membuka koneksi database SQLite secara asinkron (Expo SQLite modern).
 * Menggunakan pola singleton agar koneksi database yang sama digunakan di seluruh aplikasi.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('circadian.db');
  }
  return dbInstance;
}

/**
 * Melakukan inisialisasi database: mengaktifkan foreign keys, membuat tabel jika belum ada,
 * dan melakukan seed data awal untuk baseline dan gamifikasi.
 */
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDb();

    // Aktifkan foreign key constraints
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // 1. Buat Tabel-Tabel Utama
    await db.execAsync(`
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

      CREATE TABLE IF NOT EXISTS mood_logs (
          log_id TEXT PRIMARY KEY,
          logged_date TEXT NOT NULL,       -- format: YYYY-MM-DD
          mood_score INTEGER NOT NULL,     -- skala 1-10
          note TEXT,                       -- catatan opsional
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reminders (
          reminder_id TEXT PRIMARY KEY,
          label TEXT NOT NULL,             -- contoh: 'Minum Obat Pagi'
          type TEXT NOT NULL,              -- 'medication' | 'exercise'
          time TEXT NOT NULL,              -- format: HH:MM
          repeat_days TEXT NOT NULL,       -- JSON array string: '["Mon","Wed","Fri"]'
          is_active INTEGER DEFAULT 1,     -- 0 = off, 1 = on
          notification_id TEXT,            -- ID expo-notifications untuk membatalkan
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS gamification_progress (
          user_id TEXT PRIMARY KEY DEFAULT 'local_user',
          total_points INTEGER DEFAULT 0,
          streak_days INTEGER DEFAULT 0,
          last_active_date TEXT,           -- format: YYYY-MM-DD
          badges_unlocked TEXT DEFAULT '[]', -- JSON array string nama badge
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[SQLite] Tabel berhasil diinisialisasi.');

    // 2. Seed default circadian baselines jika masih kosong
    const countResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM circadian_baselines;'
    );
    
    if (countResult && countResult.count === 0) {
      console.log('[SQLite] Melakukan seeding data awal untuk circadian_baselines...');
      const defaultWindows = ['NOCTURNAL', 'MORNING', 'AFTERNOON', 'EVENING', 'PRE-SLEEP'];
      
      for (const w of defaultWindows) {
        await db.runAsync(
          `INSERT INTO circadian_baselines (
            window_name, 
            hrv_rmssd_mean, hrv_rmssd_std, 
            vocal_f0_mean, vocal_f0_std, 
            imu_dwell_mean, imu_dwell_std
          ) VALUES (?, 50.0, 10.0, 150.0, 20.0, 10.0, 2.0);`,
          [w]
        );
      }
      console.log('[SQLite] Seeding baselines selesai.');
    }

    // 3. Seed default progress gamifikasi
    const gamificationResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM gamification_progress;'
    );

    if (gamificationResult && gamificationResult.count === 0) {
      console.log('[SQLite] Melakukan seeding data awal untuk gamification_progress...');
      await db.runAsync(
        `INSERT INTO gamification_progress (user_id, total_points, streak_days, last_active_date, badges_unlocked)
         VALUES ('local_user', 0, 0, NULL, '[]');`
      );
      console.log('[SQLite] Seeding gamifikasi selesai.');
    }

  } catch (error) {
    console.error('[SQLite] Error saat inisialisasi database:', error);
    throw error;
  }
}

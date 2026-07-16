import { getDb } from './sqlite';

// ── TYPES FOR QUERIES ──────────────────────────────────────────────────────

export interface DbBaseline {
  window_name: string;
  hrv_rmssd_mean: number;
  hrv_rmssd_std: number;
  vocal_f0_mean: number;
  vocal_f0_std: number;
  imu_dwell_mean: number;
  imu_dwell_std: number;
  updated_at?: string;
}

export interface DbFeatureVector {
  epoch_id: string;
  timestamp: string;
  window_name: string;
  hrv_rmssd: number | null;
  hrv_zscore: number | null;
  vocal_f0: number | null;
  vocal_zscore: number | null;
  imu_dwell_min: number | null;
  imu_zscore: number | null;
  circadian_valid: number; // 0 atau 1
  suppressed_reason: string | null;
  created_at?: string;
}

export interface DbMoodLog {
  log_id: string;
  logged_date: string;
  mood_score: number;
  note: string | null;
  created_at?: string;
}

export interface DbReminder {
  reminder_id: string;
  label: string;
  type: string;
  time: string;
  repeat_days: string; // JSON array string
  is_active: number; // 0 atau 1
  notification_id: string | null;
  created_at?: string;
}

export interface DbGamificationProgress {
  user_id: string;
  total_points: number;
  streak_days: number;
  last_active_date: string | null;
  badges_unlocked: string; // JSON array string
  updated_at?: string;
}

// ── 1. CIRCADIAN BASELINES QUERIES ──────────────────────────────────────────

export async function getBaselineFromDb(windowName: string): Promise<DbBaseline | null> {
  const db = await getDb();
  return db.getFirstAsync<DbBaseline>(
    'SELECT * FROM circadian_baselines WHERE window_name = ?;',
    [windowName]
  );
}

export async function getAllBaselinesFromDb(): Promise<DbBaseline[]> {
  const db = await getDb();
  return db.getAllAsync<DbBaseline>('SELECT * FROM circadian_baselines;');
}

export async function updateBaselineInDb(
  windowName: string,
  hrvMean: number,
  hrvStd: number,
  vocalMean: number,
  vocalStd: number,
  imuMean: number,
  imuStd: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE circadian_baselines 
     SET hrv_rmssd_mean = ?, hrv_rmssd_std = ?, 
         vocal_f0_mean = ?, vocal_f0_std = ?, 
         imu_dwell_mean = ?, imu_dwell_std = ?, 
         updated_at = CURRENT_TIMESTAMP
     WHERE window_name = ?;`,
    [hrvMean, hrvStd, vocalMean, vocalStd, imuMean, imuStd, windowName]
  );
}

// ── 2. FEATURE VECTORS QUERIES ──────────────────────────────────────────────

export async function insertFeatureVector(fv: DbFeatureVector): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO feature_vectors (
      epoch_id, timestamp, window_name, 
      hrv_rmssd, hrv_zscore, 
      vocal_f0, vocal_zscore, 
      imu_dwell_min, imu_zscore, 
      circadian_valid, suppressed_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      fv.epoch_id,
      fv.timestamp,
      fv.window_name,
      fv.hrv_rmssd,
      fv.hrv_zscore,
      fv.vocal_f0,
      fv.vocal_zscore,
      fv.imu_dwell_min,
      fv.imu_zscore,
      fv.circadian_valid,
      fv.suppressed_reason,
    ]
  );
}

export async function getRecentFeatureVectors(limit: number = 50): Promise<DbFeatureVector[]> {
  const db = await getDb();
  return db.getAllAsync<DbFeatureVector>(
    'SELECT * FROM feature_vectors ORDER BY timestamp DESC LIMIT ?;',
    [limit]
  );
}

/**
 * Aturan Retensi (MOBILE.md Seksi 5): Hapus data feature_vectors berumur lebih dari 90 hari
 * untuk mencegah ukuran database membesar secara eksponensial di HP pengguna.
 */
export async function cleanupOldFeatureVectors(daysLimit: number = 90): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `DELETE FROM feature_vectors 
     WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days');`,
    [daysLimit]
  );
  return result.changes;
}

// ── 3. MOOD LOGS QUERIES ────────────────────────────────────────────────────

export async function insertMoodLog(loggedDate: string, moodScore: number, note: string | null): Promise<void> {
  const db = await getDb();
  const logId = `${loggedDate}_${Date.now()}`;
  await db.runAsync(
    `INSERT INTO mood_logs (log_id, logged_date, mood_score, note) 
     VALUES (?, ?, ?, ?);`,
    [logId, loggedDate, moodScore, note]
  );
}

export async function getRecentMoodLogs(limit: number = 30): Promise<DbMoodLog[]> {
  const db = await getDb();
  return db.getAllAsync<DbMoodLog>(
    'SELECT * FROM mood_logs ORDER BY logged_date DESC, created_at DESC LIMIT ?;',
    [limit]
  );
}

// ── 4. REMINDERS QUERIES ────────────────────────────────────────────────────

export async function getRemindersFromDb(): Promise<DbReminder[]> {
  const db = await getDb();
  return db.getAllAsync<DbReminder>('SELECT * FROM reminders ORDER BY time ASC;');
}

export async function insertReminderInDb(reminder: DbReminder): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminders (reminder_id, label, type, time, repeat_days, is_active, notification_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      reminder.reminder_id,
      reminder.label,
      reminder.type,
      reminder.time,
      reminder.repeat_days,
      reminder.is_active,
      reminder.notification_id,
    ]
  );
}

export async function updateReminderStatusInDb(reminderId: string, isActive: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE reminders SET is_active = ? WHERE reminder_id = ?;',
    [isActive ? 1 : 0, reminderId]
  );
}

export async function deleteReminderFromDb(reminderId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE reminder_id = ?;', [reminderId]);
}

// ── 5. GAMIFICATION PROGRESS QUERIES ────────────────────────────────────────

export async function getGamificationProgress(): Promise<DbGamificationProgress> {
  const db = await getDb();
  const result = await db.getFirstAsync<DbGamificationProgress>(
    "SELECT * FROM gamification_progress WHERE user_id = 'local_user';"
  );
  if (!result) {
    throw new Error('[SQLite] Progress gamifikasi tidak ditemukan.');
  }
  return result;
}

export async function updateGamificationProgress(
  points: number,
  streak: number,
  lastActiveDate: string,
  badgesUnlockedJsonStr: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE gamification_progress 
     SET total_points = ?, streak_days = ?, last_active_date = ?, 
         badges_unlocked = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = 'local_user';`,
    [points, streak, lastActiveDate, badgesUnlockedJsonStr]
  );
}

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  insertNotificationLog,
  getNotificationLogByReference,
  confirmNotificationLog,
  getTodayAnomalies,
  DbNotificationLog,
} from '../database/queries';

type NotificationCategory = 'REMINDER' | 'PHASE_ALERT';

class BipolyzerNotificationService {
  private isInitialized = false;
  private dailySummaryTimer: ReturnType<typeof setInterval> | null = null;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!Device.isDevice) {
      console.log('[NotificationService] Notifikasi hanya tersedia di perangkat fisik.');
      return;
    }

    await this.setupNotificationHandler();
    await this.requestPermissions();
    await this.setupAndroidChannel();

    this.isInitialized = true;
    console.log('[NotificationService] Initialized.');
  }

  private async setupNotificationHandler(): Promise<void> {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  private async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Permission denied.');
      return false;
    }
    return true;
  }

  private async setupAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifikasi BIPOLYZER',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#A88AD3',
      });
    }
  }

  public async scheduleReminder(
    reminderId: string,
    title: string,
    body: string,
    hour: number,
    minute: number,
    repeatDays: string[]
  ): Promise<string | null> {
    if (!this.isInitialized) {
      console.warn('[NotificationService] Not initialized.');
      return null;
    }

    const triggers = this.buildWeeklyTriggers(hour, minute, repeatDays);
    const ids: string[] = [];

    for (const trigger of triggers) {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: `reminder_${reminderId}_${trigger.weekday}`,
        content: {
          title,
          body,
          data: { type: 'reminder', reminderId },
          sound: true,
        },
        trigger: trigger as Notifications.NotificationTriggerInput,
      });
      ids.push(id);
    }

    return ids.join(',');
  }

  public async cancelReminder(reminderId: string): Promise<void> {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of allScheduled) {
      if (notif.identifier.includes(`reminder_${reminderId}`)) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  }

  private buildWeeklyTriggers(hour: number, minute: number, repeatDays: string[]) {
    const dayMap: Record<string, number> = {
      Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
    };

    return repeatDays
      .map((day) => dayMap[day])
      .filter((weekday): weekday is number => weekday !== undefined)
      .map((weekday) => ({
        type: 'weekly' as const,
        weekday,
        hour,
        minute,
      }));
  }

  public async sendPhaseSummary(): Promise<void> {
    if (!this.isInitialized) return;

    const today = new Date().toISOString().split('T')[0];
    const existing = await getNotificationLogByReference(today);
    if (existing) {
      console.log('[NotificationService] Phase summary sudah dikirim hari ini.');
      return;
    }

    const anomalies = await getTodayAnomalies();

    if (anomalies.length === 0) {
      console.log('[NotificationService] Tidak ada anomali hari ini, skip summary.');
      return;
    }

    const windowSummary = this.groupAnomaliesByWindow(anomalies);
    const body = this.buildSummaryBody(anomalies.length, windowSummary);

    const logId = `phase_${today}_${Date.now()}`;
    const log: DbNotificationLog = {
      log_id: logId,
      type: 'phase_summary',
      reference_id: today,
      title: 'Ringkasan Sirkadian Hari Ini',
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
      confirmed_at: null,
    };

    await insertNotificationLog(log);

    await Notifications.scheduleNotificationAsync({
      identifier: logId,
      content: {
        title: log.title,
        body: log.body,
        data: { type: 'phase_summary', date: today },
        sound: true,
      },
      trigger: null,
    });

    console.log(`[NotificationService] Phase summary dikirim: ${anomalies.length} anomali.`);
  }

  private groupAnomaliesByWindow(anomalies: { window_name: string; timestamp: string }[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    for (const a of anomalies) {
      if (!grouped[a.window_name]) grouped[a.window_name] = [];
      const time = new Date(a.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      grouped[a.window_name].push(time);
    }
    return grouped;
  }

  private buildSummaryBody(count: number, windowSummary: Record<string, string[]>): string {
    const lines = [`${count} anomali terdeteksi hari ini:`];
    for (const [window, times] of Object.entries(windowSummary)) {
      lines.push(`• ${window} (${times.join(', ')})`);
    }
    lines.push('Tap untuk lihat detail.');
    return lines.join('\n');
  }

  public async sendDailyCheckReminder(): Promise<void> {
    if (!this.isInitialized) return;

    const today = new Date().toISOString().split('T')[0];
    const refId = `daily_check_${today}`;
    const existing = await getNotificationLogByReference(refId);
    if (existing) return;

    const logId = `daily_${today}_${Date.now()}`;
    const log: DbNotificationLog = {
      log_id: logId,
      type: 'daily_check',
      reference_id: refId,
      title: 'Cek Kondisi Pagi',
      body: 'Jangan lupa isi mood tracker dan cek kondisi hari ini.',
      status: 'sent',
      sent_at: new Date().toISOString(),
      confirmed_at: null,
    };

    await insertNotificationLog(log);

    await Notifications.scheduleNotificationAsync({
      identifier: logId,
      content: {
        title: log.title,
        body: log.body,
        data: { type: 'daily_check', date: today },
        sound: true,
      },
      trigger: null,
    });
  }

  public async confirmNotification(logId: string): Promise<void> {
    await confirmNotificationLog(logId);
  }

  public startDailySummarySchedule(summaryHour: number = 21, summaryMinute: number = 0): void {
    this.stopDailySummarySchedule();

    this.dailySummaryTimer = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === summaryHour && now.getMinutes() === summaryMinute) {
        await this.sendPhaseSummary();
      }
    }, 60000);

    console.log(`[NotificationService] Daily summary scheduled at ${summaryHour}:${summaryMinute.toString().padStart(2, '0')}.`);
  }

  public stopDailySummarySchedule(): void {
    if (this.dailySummaryTimer) {
      clearInterval(this.dailySummaryTimer);
      this.dailySummaryTimer = null;
    }
  }

  public async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.stopDailySummarySchedule();
  }
}

export const notificationService = new BipolyzerNotificationService();

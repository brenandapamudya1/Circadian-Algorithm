import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { getRemindersFromDb, updateReminderStatusInDb, DbReminder } from '../database/queries';
import { notificationService } from '../services/notificationService';
import { styles } from '../constants/theme';

export const DailyReminderCard: React.FC = () => {
  const [reminders, setReminders] = useState<DbReminder[]>([]);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      const data = await getRemindersFromDb();
      setReminders(data);
    } catch (err) {
      console.warn('Gagal memuat pengingat:', err);
    }
  };

  const toggleReminder = async (reminder: DbReminder) => {
    const newActive = reminder.is_active === 0 ? 1 : 0;
    await updateReminderStatusInDb(reminder.reminder_id, newActive === 1);

    if (newActive === 1) {
      const [h, m] = reminder.time.split(':').map(Number);
      const title = reminder.type === 'obat' ? '💊 Minum Obat' : '🏃 Olahraga';
      const body = `${reminder.label} — ${reminder.time}`;
      await notificationService.scheduleReminder(reminder.reminder_id, title, body, h, m, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    } else {
      await notificationService.cancelReminder(reminder.reminder_id);
    }

    loadReminders();
  };

  const activeReminders = reminders.filter(r => r.is_active === 1);

  return (
    <View style={styles.dailyReminderCard}>
      <View style={styles.dailyReminderHeader}>
        <Text style={styles.dailyReminderTitle}>Jadwal Hari Ini</Text>
      </View>

      {activeReminders.length === 0 ? (
        <Text style={styles.dailyReminderEmpty}>Belum ada jadwal aktif</Text>
      ) : (
        activeReminders.map((reminder) => (
          <View key={reminder.reminder_id} style={styles.dailyReminderRow}>
            <View style={styles.dailyReminderInfo}>
              <Text style={styles.dailyReminderLabel}>{reminder.label}</Text>
              <Text style={styles.dailyReminderTime}>
                {reminder.time} · {reminder.type === 'obat' ? 'Obat' : 'Olahraga'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, styles.toggleOn]}
              onPress={() => toggleReminder(reminder)}
            >
              <View style={[styles.toggleThumb, styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
};

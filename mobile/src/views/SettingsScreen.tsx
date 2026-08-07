import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { ConnectionState } from '../services/bleManager';
import { notificationService } from '../services/notificationService';
import { styles } from '../constants/theme';

interface Reminder {
  id: string;
  label: string;
  time: string;
  active: boolean;
  type: 'obat' | 'olahraga';
}

interface SettingsScreenProps {
  bleConnectionState: ConnectionState;
  onOpenBleScanner: () => void;
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: '1', label: 'Minum Obat Pagi (Lithium)', time: '07:00', active: true, type: 'obat' },
  { id: '2', label: 'Olahraga Sore (Jalan Kaki)', time: '16:30', active: true, type: 'olahraga' },
  { id: '3', label: 'Minum Obat Malam', time: '21:00', active: false, type: 'obat' },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ bleConnectionState, onOpenBleScanner }) => {
  const [notifFaseOn, setNotifFaseOn] = useState(true);
  const [notifHarianOn, setNotifHarianOn] = useState(false);

  const [reminders, setReminders] = useState<Reminder[]>(DEFAULT_REMINDERS);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [newType, setNewType] = useState<'obat' | 'olahraga'>('obat');

  const parseTime = (time: string): { hour: number; minute: number } => {
    const [h, m] = time.split(':').map(Number);
    return { hour: h || 0, minute: m || 0 };
  };

  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scheduleReminderNotif = async (reminder: Reminder) => {
    const { hour, minute } = parseTime(reminder.time);
    const notifType = reminder.type === 'obat' ? 'medication' : 'exercise';
    const title = reminder.type === 'obat' ? '💊 Minum Obat' : '🏃 Olahraga';
    const body = `${reminder.label} — ${reminder.time}`;

    await notificationService.scheduleReminder(
      reminder.id,
      title,
      body,
      hour,
      minute,
      allDays
    );
  };

  const toggleReminder = async (id: string) => {
    setReminders(prev => {
      const updated = prev.map(rem => {
        if (rem.id !== id) return rem;
        const newActive = !rem.active;
        const updatedRem = { ...rem, active: newActive };

        if (newActive) {
          scheduleReminderNotif(updatedRem);
        } else {
          notificationService.cancelReminder(id);
        }

        return updatedRem;
      });
      return updated;
    });
  };

  const handleSaveReminder = async () => {
    if (!newLabel.trim()) return;
    const newRem: Reminder = {
      id: Date.now().toString(),
      label: newLabel,
      time: newTime,
      active: true,
      type: newType,
    };
    setReminders(prev => [...prev, newRem]);
    await scheduleReminderNotif(newRem);
    setNewLabel('');
    setNewTime('08:00');
    setNewType('obat');
    setShowAddForm(false);
  };

  const handleDeleteReminder = async (id: string) => {
    await notificationService.cancelReminder(id);
    setReminders(prev => prev.filter(rem => rem.id !== id));
  };

  const toggleNotifFase = (value: boolean) => {
    setNotifFaseOn(value);
    if (value) {
      notificationService.startDailySummarySchedule(21, 0);
    } else {
      notificationService.stopDailySummarySchedule();
    }
  };

  const toggleNotifHarian = (value: boolean) => {
    setNotifHarianOn(value);
    if (value) {
      notificationService.startDailySummarySchedule(7, 0);
    }
  };

  return (
    <View style={styles.pengaturanContainer}>
      <Text style={styles.pengaturanTitle}>Pengaturan</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        <Text style={styles.profileName}>Kim Jennie</Text>
        <Text style={styles.profileRole}>Pasien · BIPOLYZER</Text>
      </View>

      <View style={styles.settingSection}>
        <Text style={styles.settingSectionLabel}>PERANGKAT</Text>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={onOpenBleScanner}
        >
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>Koneksi Gelang</Text>
            <Text style={styles.settingRowSub}>
              {bleConnectionState === 'connected' ? 'Circadian · Terhubung' :
               bleConnectionState === 'connecting' ? 'Menghubungkan...' :
               bleConnectionState === 'scanning' ? 'Mencari gelang...' :
               'Belum terhubung · Tap untuk mencari'}
            </Text>
          </View>
          <Text style={styles.settingRowIcon}>
            {bleConnectionState === 'connected' ? '✓' : '⑂'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingSection}>
        <Text style={styles.settingSectionLabel}>NOTIFIKASI</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>Peringatan Fase</Text>
            <Text style={styles.settingRowSub}>Ringkasan anomali tiap malam (21:00)</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, notifFaseOn ? styles.toggleOn : styles.toggleOff]}
            onPress={() => toggleNotifFase(!notifFaseOn)}
          >
            <View style={[styles.toggleThumb, notifFaseOn ? styles.toggleThumbOn : styles.toggleThumbOff]} />
          </TouchableOpacity>
        </View>

        <View style={[styles.settingRow, styles.settingRowNoBorder]}>
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>Pengingat Harian</Text>
            <Text style={styles.settingRowSub}>Cek kondisi pagi hari (07:00)</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, notifHarianOn ? styles.toggleOn : styles.toggleOff]}
            onPress={() => toggleNotifHarian(!notifHarianOn)}
          >
            <View style={[styles.toggleThumb, notifHarianOn ? styles.toggleThumbOn : styles.toggleThumbOff]} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingSection}>
        <Text style={styles.settingSectionLabel}>PENGINGAT KESEHATAN</Text>

        {reminders.map((reminder, index) => {
          const isLast = index === reminders.length - 1;
          return (
            <View key={reminder.id} style={[styles.reminderRow, isLast && styles.reminderRowNoBorder]}>
              <View style={styles.reminderLeft}>
                <View style={styles.reminderMeta}>
                  <Text style={styles.reminderTitle}>{reminder.label}</Text>
                  <Text style={styles.reminderTime}>{reminder.time} · {reminder.type === 'obat' ? 'Obat' : 'Olahraga'}</Text>
                </View>
              </View>

              <View style={styles.reminderRightActions}>
                <TouchableOpacity
                  style={[styles.toggle, reminder.active ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => toggleReminder(reminder.id)}
                >
                  <View style={[styles.toggleThumb, reminder.active ? styles.toggleThumbOn : styles.toggleThumbOff]} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteReminderTextBtn}
                  onPress={() => handleDeleteReminder(reminder.id)}
                >
                  <Text style={styles.deleteReminderText}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {showAddForm ? (
          <View style={styles.addReminderForm}>
            <Text style={styles.formLabel}>Nama Pengingat</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Contoh: Minum Vitamin C"
              value={newLabel}
              onChangeText={setNewLabel}
              placeholderTextColor="#A89CB8"
            />

            <Text style={styles.formLabel}>Waktu (Jam)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Contoh: 08:00"
              value={newTime}
              onChangeText={setNewTime}
              placeholderTextColor="#A89CB8"
            />

            <Text style={styles.formLabel}>Kategori</Text>
            <View style={styles.formTypeRow}>
              <TouchableOpacity
                style={[styles.formTypeBtn, newType === 'obat' && styles.formTypeBtnActive]}
                onPress={() => setNewType('obat')}
              >
                <Text style={[styles.formTypeBtnText, newType === 'obat' && styles.formTypeBtnTextActive]}> Obat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formTypeBtn, newType === 'olahraga' && styles.formTypeBtnActive]}
                onPress={() => setNewType('olahraga')}
              >
                <Text style={[styles.formTypeBtnText, newType === 'olahraga' && styles.formTypeBtnTextActive]}> Olahraga</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.formCancelBtn}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={styles.formCancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.formSaveBtn}
                onPress={handleSaveReminder}
              >
                <Text style={styles.formSaveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addReminderBtn}
            onPress={() => setShowAddForm(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addReminderBtnText}>+ Tambah Pengingat</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.settingSection}>
        <TouchableOpacity style={[styles.settingRow, styles.settingRowNoBorder]}>
          <Text style={styles.settingRowTitleBold}>Kontak darurat</Text>
          <Text style={styles.settingRowChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Linking, Alert, ScrollView } from 'react-native';
import { ConnectionState } from '../services/bleManager';
import { notificationService } from '../services/notificationService';
import {
  getEmergencyContacts,
  insertEmergencyContact,
  deleteEmergencyContact,
  DbEmergencyContact,
  getFeatureVectorCount,
  getOldestFeatureVector,
  clearAllFeatureVectors,
  getPin,
  setPin,
  getUsername,
  setUsername,
  getRemindersFromDb,
  insertReminderInDb,
  updateReminderStatusInDb,
  deleteReminderFromDb,
  DbReminder,
} from '../database/queries';
import { styles, colors } from '../constants/theme';

interface SettingsScreenProps {
  bleConnectionState: ConnectionState;
  onOpenBleScanner: () => void;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}-${cleaned.slice(10)}`;
  }
  if (cleaned.startsWith('0')) {
    return `+62 ${cleaned.slice(1, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ bleConnectionState, onOpenBleScanner }) => {
  const [notifFaseOn, setNotifFaseOn] = useState(true);
  const [notifHarianOn, setNotifHarianOn] = useState(false);
  const [reminders, setReminders] = useState<DbReminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [newType, setNewType] = useState<'obat' | 'olahraga'>('obat');

  const [emergencyContacts, setEmergencyContacts] = useState<DbEmergencyContact[]>([]);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [selectedContact, setSelectedContact] = useState<DbEmergencyContact | null>(null);

  const [dataCount, setDataCount] = useState(0);
  const [oldestData, setOldestData] = useState<string | null>(null);

  const [username, setUsernameState] = useState('User');
  const [showPinForm, setShowPinForm] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    loadReminders();
    loadEmergencyContacts();
    loadDataStorageInfo();
    loadUserInfo();
  }, []);

  const loadReminders = async () => {
    try {
      const data = await getRemindersFromDb();
      if (data.length === 0) {
        const defaults: DbReminder[] = [
          { reminder_id: '1', label: 'Minum Obat Pagi (Lithium)', type: 'obat', time: '07:00', repeat_days: '["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]', is_active: 1, notification_id: null },
          { reminder_id: '2', label: 'Olahraga Sore (Jalan Kaki)', type: 'olahraga', time: '16:30', repeat_days: '["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]', is_active: 1, notification_id: null },
          { reminder_id: '3', label: 'Minum Obat Malam', type: 'obat', time: '21:00', repeat_days: '["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]', is_active: 0, notification_id: null },
        ];
        for (const r of defaults) {
          await insertReminderInDb(r);
        }
        setReminders(defaults);
        for (const r of defaults) {
          if (r.is_active === 1) {
            const [h, m] = r.time.split(':').map(Number);
            const title = r.type === 'obat' ? '💊 Minum Obat' : '🏃 Olahraga';
            const body = `${r.label} — ${r.time}`;
            await notificationService.scheduleReminder(r.reminder_id, title, body, h, m, JSON.parse(r.repeat_days));
          }
        }
      } else {
        setReminders(data);
      }
    } catch (err) {
      console.warn('Gagal memuat pengingat:', err);
    }
  };

  const loadDataStorageInfo = async () => {
    try {
      const count = await getFeatureVectorCount();
      setDataCount(count);
      const oldest = await getOldestFeatureVector();
      if (oldest) {
        const d = new Date(oldest.timestamp);
        setOldestData(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }));
      } else {
        setOldestData(null);
      }
    } catch (err) {
      console.warn('Gagal memuat info storage:', err);
    }
  };

  const loadUserInfo = async () => {
    try {
      const savedUsername = await getUsername();
      setUsernameState(savedUsername);
    } catch (err) {
      console.warn('Gagal memuat info user:', err);
    }
  };

  const handleChangePin = async () => {
    if (currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      Alert.alert('Error', 'PIN harus 4 digit');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'PIN baru tidak cocok');
      return;
    }
    const savedPin = await getPin();
    if (currentPin !== savedPin) {
      Alert.alert('Error', 'PIN lama salah');
      return;
    }
    await setPin(newPin);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setShowPinForm(false);
    Alert.alert('Berhasil', 'PIN berhasil diubah');
  };

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert('Error', 'Username tidak boleh kosong');
      return;
    }
    await setUsername(newUsername.trim());
    setUsernameState(newUsername.trim());
    setNewUsername('');
    setShowUsernameForm(false);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Hapus Semua Data',
      `Hapus ${dataCount} epoch data sensor? Tindakan ini tidak dapat dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const deleted = await clearAllFeatureVectors();
            console.log(`[Settings] Dihapus ${deleted} epoch dari SQLite.`);
            await loadDataStorageInfo();
          },
        },
      ]
    );
  };

  const loadEmergencyContacts = async () => {
    try {
      const contacts = await getEmergencyContacts();
      setEmergencyContacts(contacts);
    } catch (err) {
      console.warn('Gagal memuat kontak darurat:', err);
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    await insertEmergencyContact(newContactName.trim(), newContactPhone.trim());
    setNewContactName('');
    setNewContactPhone('');
    setShowAddContactForm(false);
    await loadEmergencyContacts();
  };

  const handleDeleteContact = async (contactId: string) => {
    await deleteEmergencyContact(contactId);
    setSelectedContact(null);
    await loadEmergencyContacts();
  };

  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const formatted = cleaned.startsWith('0') ? `+62${cleaned.slice(1)}` : cleaned;
    Linking.openURL(`tel:${formatted}`);
    setSelectedContact(null);
  };

  const handleSms = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const formatted = cleaned.startsWith('0') ? `+62${cleaned.slice(1)}` : cleaned;
    Linking.openURL(`sms:${formatted}`);
    setSelectedContact(null);
  };

  const handleWhatsapp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const formatted = cleaned.startsWith('0') ? `62${cleaned.slice(1)}` : cleaned;
    Linking.openURL(`https://wa.me/${formatted}`);
    setSelectedContact(null);
  };

  const parseTime = (time: string): { hour: number; minute: number } => {
    const [h, m] = time.split(':').map(Number);
    return { hour: h || 0, minute: m || 0 };
  };

  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scheduleReminderNotif = async (reminder: DbReminder) => {
    const { hour, minute } = parseTime(reminder.time);
    const title = reminder.type === 'obat' ? '💊 Minum Obat' : '🏃 Olahraga';
    const body = `${reminder.label} — ${reminder.time}`;
    const days = JSON.parse(reminder.repeat_days) as string[];
    await notificationService.scheduleReminder(reminder.reminder_id, title, body, hour, minute, days);
  };

  const toggleReminder = async (id: string) => {
    const reminder = reminders.find(r => r.reminder_id === id);
    if (!reminder) return;

    const newActive = reminder.is_active === 0;
    await updateReminderStatusInDb(id, newActive);

    if (newActive) {
      await scheduleReminderNotif(reminder);
    } else {
      await notificationService.cancelReminder(id);
    }

    setReminders(prev => prev.map(r =>
      r.reminder_id === id ? { ...r, is_active: newActive ? 1 : 0 } : r
    ));
  };

  const handleSaveReminder = async () => {
    if (!newLabel.trim()) return;
    const id = Date.now().toString();
    const newRem: DbReminder = {
      reminder_id: id,
      label: newLabel,
      type: newType,
      time: newTime,
      repeat_days: JSON.stringify(allDays),
      is_active: 1,
      notification_id: null,
    };
    await insertReminderInDb(newRem);
    await scheduleReminderNotif(newRem);
    setReminders(prev => [...prev, newRem]);
    setNewLabel('');
    setNewTime('08:00');
    setNewType('obat');
    setShowAddForm(false);
  };

  const handleDeleteReminder = async (id: string) => {
    await notificationService.cancelReminder(id);
    await deleteReminderFromDb(id);
    setReminders(prev => prev.filter(r => r.reminder_id !== id));
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
    <View style={styles.settingsOverlay}>
      <ScrollView
        contentContainerStyle={styles.settingsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pengaturanContainer}>
          <Text style={styles.pengaturanTitle}>Pengaturan</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        <Text style={styles.profileName}>{username}</Text>
        <Text style={styles.profileRole}>Pasien · BIPOLYZER</Text>
      </View>

      <View style={styles.settingSection}>
        <Text style={styles.settingSectionLabel}>AKUN</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            setShowUsernameForm(!showUsernameForm);
            setNewUsername(username);
          }}
        >
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>Username</Text>
            <Text style={styles.settingRowSub}>{username}</Text>
          </View>
          <Text style={styles.settingRowChevron}>›</Text>
        </TouchableOpacity>

        {showUsernameForm && (
          <View style={styles.addReminderForm}>
            <Text style={styles.formLabel}>Username Baru</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Masukkan username baru"
              value={newUsername}
              onChangeText={setNewUsername}
              placeholderTextColor="#A89CB8"
            />
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowUsernameForm(false)}>
                <Text style={styles.formCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.formSaveBtn} onPress={handleChangeUsername}>
                <Text style={styles.formSaveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowNoBorder]}
          onPress={() => setShowPinForm(!showPinForm)}
        >
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>Ganti PIN</Text>
            <Text style={styles.settingRowSub}>Ubah PIN keamanan aplikasi</Text>
          </View>
          <Text style={styles.settingRowChevron}>›</Text>
        </TouchableOpacity>

        {showPinForm && (
          <View style={styles.addReminderForm}>
            <Text style={styles.formLabel}>PIN Lama</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Masukkan PIN lama"
              value={currentPin}
              onChangeText={setCurrentPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              placeholderTextColor="#A89CB8"
            />
            <Text style={styles.formLabel}>PIN Baru</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Masukkan PIN baru (4 digit)"
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              placeholderTextColor="#A89CB8"
            />
            <Text style={styles.formLabel}>Konfirmasi PIN Baru</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ulangi PIN baru"
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              placeholderTextColor="#A89CB8"
            />
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.formCancelBtn} onPress={() => {
                setShowPinForm(false);
                setCurrentPin('');
                setNewPin('');
                setConfirmPin('');
              }}>
                <Text style={styles.formCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.formSaveBtn} onPress={handleChangePin}>
                <Text style={styles.formSaveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.settingSection}>
        <Text style={styles.settingSectionLabel}>PERANGKAT</Text>
        <TouchableOpacity style={styles.settingRow} onPress={onOpenBleScanner}>
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
        <Text style={styles.settingSectionLabel}>PENYIMPANAN DATA</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>Total Epoch Tersimpan</Text>
            <Text style={styles.settingRowSub}>
              {dataCount > 0 ? `${dataCount} epoch` : 'Belum ada data'}
            </Text>
          </View>
        </View>

        {oldestData && (
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Text style={styles.settingRowTitle}>Data Tertua</Text>
              <Text style={styles.settingRowSub}>{oldestData}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowNoBorder]}
          onPress={handleClearAllData}
          disabled={dataCount === 0}
        >
          <View style={styles.settingRowLeft}>
            <Text style={[styles.settingRowTitle, dataCount > 0 && { color: '#E53935' }]}>
              Hapus Semua Data
            </Text>
            <Text style={styles.settingRowSub}>
              {dataCount > 0 ? 'Tidak dapat dibatalkan' : 'Tidak ada data untuk dihapus'}
            </Text>
          </View>
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
            <View key={reminder.reminder_id} style={[styles.reminderRow, isLast && styles.reminderRowNoBorder]}>
              <View style={styles.reminderLeft}>
                <View style={styles.reminderMeta}>
                  <Text style={styles.reminderTitle}>{reminder.label}</Text>
                  <Text style={styles.reminderTime}>{reminder.time} · {reminder.type === 'obat' ? 'Obat' : 'Olahraga'}</Text>
                </View>
              </View>
              <View style={styles.reminderRightActions}>
                <TouchableOpacity
                  style={[styles.toggle, reminder.is_active ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => toggleReminder(reminder.reminder_id)}
                >
                  <View style={[styles.toggleThumb, reminder.is_active ? styles.toggleThumbOn : styles.toggleThumbOff]} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteReminderTextBtn} onPress={() => handleDeleteReminder(reminder.reminder_id)}>
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
              <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowAddForm(false)}>
                <Text style={styles.formCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.formSaveBtn} onPress={handleSaveReminder}>
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
        <Text style={styles.settingSectionLabel}>BANTUAN DARURAT</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => Linking.openURL('https://www.google.com/maps/search/rumah+sakit+jiwa+terdekat')}
        >
          <View style={styles.settingRowLeft}>
            <Text style={styles.settingRowTitle}>RS Jiwa Terdekat</Text>
            <Text style={styles.settingRowSub}>Cari di Google Maps</Text>
          </View>
          <Text style={styles.settingRowIcon}>🗺</Text>
        </TouchableOpacity>

        {emergencyContacts.map((contact, index) => {
          const isLast = index === emergencyContacts.length - 1 && !showAddContactForm;
          return (
            <TouchableOpacity
              key={contact.contact_id}
              style={[styles.emergencyContactRow, isLast && styles.emergencyContactRowLast]}
              onPress={() => setSelectedContact(contact)}
              activeOpacity={0.7}
            >
              <View style={styles.emergencyContactAvatar}>
                <Text style={styles.emergencyContactAvatarText}>{getInitials(contact.name)}</Text>
              </View>
              <View style={styles.emergencyContactInfo}>
                <Text style={styles.emergencyContactName}>{contact.name}</Text>
                <Text style={styles.emergencyContactPhone}>{formatPhone(contact.phone)}</Text>
              </View>
              <Text style={styles.settingRowChevron}>›</Text>
            </TouchableOpacity>
          );
        })}

        {showAddContactForm ? (
          <View style={styles.addReminderForm}>
            <Text style={styles.formLabel}>Nama RS / Kontak</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Contoh: RS Jiwa Surabaya"
              value={newContactName}
              onChangeText={setNewContactName}
              placeholderTextColor="#A89CB8"
            />
            <Text style={styles.formLabel}>Nomor Telepon</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Contoh: 081234567890"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#A89CB8"
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.formCancelBtn}
                onPress={() => {
                  setShowAddContactForm(false);
                  setNewContactName('');
                  setNewContactPhone('');
                }}
              >
                <Text style={styles.formCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.formSaveBtn} onPress={handleAddContact}>
                <Text style={styles.formSaveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addReminderBtn}
            onPress={() => setShowAddContactForm(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addReminderBtnText}>+ Tambah Kontak RS Darurat</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedContact && (
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedContact(null)}
        >
          <View style={styles.actionModalContent}>
            <View style={styles.actionModalHeader}>
              <View style={styles.actionModalAvatar}>
                <Text style={styles.actionModalAvatarText}>{getInitials(selectedContact.name)}</Text>
              </View>
              <View>
                <Text style={styles.actionModalName}>{selectedContact.name}</Text>
                <Text style={styles.actionModalPhone}>{formatPhone(selectedContact.phone)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonCall]}
              onPress={() => handleCall(selectedContact.phone)}
            >
              <Text style={styles.actionButtonIcon}>📞</Text>
              <Text style={[styles.actionButtonText, styles.actionButtonTextCall]}>Telepon</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSms]}
              onPress={() => handleSms(selectedContact.phone)}
            >
              <Text style={styles.actionButtonIcon}>💬</Text>
              <Text style={[styles.actionButtonText, styles.actionButtonTextSms]}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonWhatsapp]}
              onPress={() => handleWhatsapp(selectedContact.phone)}
            >
              <Text style={styles.actionButtonIcon}>🟢</Text>
              <Text style={[styles.actionButtonText, styles.actionButtonTextWhatsapp]}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDelete]}
              onPress={() => {
                Alert.alert(
                  'Hapus Kontak',
                  `Hapus ${selectedContact.name} dari kontak darurat?`,
                  [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Hapus', style: 'destructive', onPress: () => handleDeleteContact(selectedContact.contact_id) },
                  ]
                );
              }}
            >
              <Text style={styles.actionButtonIcon}>🗑</Text>
              <Text style={[styles.actionButtonText, styles.actionButtonTextDelete]}>Hapus Kontak</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonCancel]}
              onPress={() => setSelectedContact(null)}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextCancel]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
        </View>
      </ScrollView>
    </View>
  );
};

# REVISI UI/UX - PLANNING & PROGRESS TRACKER

> Sumber: Feedback Dokter + Rekan Tim
> Dibuat: 21 Agustus 2026
> Status: **DALAM PERENCANAAN**

---

## RINGKASAN FEEDBACK DOKTER

1. Chart di app ganti jadi chart weekly & monthly
2. Chart vocal tidak perlu untuk user (privasi dokter)
3. Tampilkan informasi yang dibutuhkan user saja
4. Pengingat kesehatan taruh di Home (daily reminder), jangan digabung settings
5. Settings floating (icon gear) di tiap halaman, bottom nav hanya fitur
6. Arahkan ke RS jiwa terdekat dan suicide hotline (bukan Halodoc/sosmed)
7. Settings: ganti PIN dan username
8. Gamifikasi (seperti Calm Harm)
9. UI/UX ambil referensi Calm Harm (warna per fase, ambient design)
10. Kalibrasi HRV: ECG Holter, sewa lab, RS, Bu Nada Biomedik (free)
11. Test dengan orang normal dulu 1 minggu

---

## PHASE 0: QUICK FIXES (Prioritas Tinggi)

### P0-1: Settings Floating di Tiap Halaman
- [x] Hapus tab "Pengaturan" dari BottomNav (jadikan 3 tab)
- [x] Tambah icon gear di header semua screen (Beranda, Tren, Riwayat)
- [x] Tap icon → navigate ke SettingsScreen
- [x] Update App.tsx navigation state

**Files:** `BottomNav.tsx`, `App.tsx`, `HomeScreen.tsx`, `TrenScreen.tsx`, `RiwayatScreen.tsx`

---

### P0-2: Daily Reminder di HomeScreen
- [x] Buat component `DailyReminderCard`
- [x] Tampilkan jadwal obat/hari ini dari database
- [x] Toggle on/off per reminder langsung dari Home
- [x] SettingsScreen: sisa CRUD (tambah/hapus/edit jadwal) saja

**Files:** `HomeScreen.tsx`, `SettingsScreen.tsx`, `DailyReminderCard.tsx`

---

### P0-3: Chart Weekly & Monthly
- [x] Hapus progress rings (M,S,S,R,K,J,S) dari HomeScreen
- [x] TrenScreen: buat 2 tab "Mingguan" / "Bulanan"
- [x] Mingguan: chart line 7 titik (Sen-Sab) = rata-rata fase per hari
- [x] Bulanan: chart line 4 minggu (M1-M4) = rata-rata per minggu
- [x] Warna chart: hijau=stabil, kuning=manik, merah=depresi

**Files:** `TrenScreen.tsx`, `HomeScreen.tsx`

---

### P0-4: Sembunyikan Chart Vocal
- [x] Hapus chart "Biomarker Vokal" dari TrenScreen
- [x] Data vocal tetap disimpan di SQLite (untuk export dokter)
- [x] Sembunyikan metric card vocal dari HomeScreen

**Files:** `TrenScreen.tsx`, `HomeScreen.tsx`

---

### P0-5: Simplifikasi HomeScreen
- [x] Tampilkan: Fase saat ini + Jadwal obat hari ini + Mood tracker
- [x] Hapus metric cards teknis (HRV value, Vocal value, Dwell time)
- [x] Alert panel tetap ada (anomaly/gated/normal)

**Files:** `HomeScreen.tsx`

---

### P0-6: RS Jiwa & Suicide Hotline
- [x] Ganti section "KONTAK DARURAT" jadi "BANTUAN DARURAT"
- [x] Tambah hotline resmi:
  - Kemenkes Crisis Center: 119 (ext 8)
  - Hotline Jiwa Kemenkes: 021-500-567
  - Yayasan Pulih: 021-565-5011
- [x] Tombol "RS Jiwa Terdekat" → buka Google Maps search
- [x] Kontak personal tetap bisa ditambah (keluarga)

**Files:** `SettingsScreen.tsx`

---

## PHASE 1: ACCOUNT & SECURITY

### P1-1: Ganti PIN
- [ ] Section "AKUN" di SettingsScreen
- [ ] Input PIN lama → PIN baru → konfirmasi
- [ ] Simpan PIN di AsyncStorage (hashed)
- [ ] LockScreen baca PIN dari AsyncStorage

**Files:** `SettingsScreen.tsx`, `LockScreen.tsx`, `App.tsx`

---

### P1-2: Ganti Username
- [ ] Input username baru → simpan
- [ ] Simpan di AsyncStorage
- [ ] Profile card baca dari AsyncStorage

**Files:** `SettingsScreen.tsx`, `App.tsx`

---

## PHASE 2: GAMIFICATION

### P2-1: Achievement/Badge System
- [ ] Buat component `GamificationBadge.tsx`
- [ ] Badge definitions:
  - "7 Hari Stabil" → badge
  - "30 Hari Konsisten" → badge
  - "Mood Tracker 7 Hari" → badge
  - "Pertama Kali Connect BLE" → badge
- [ ] Query CRUD ke `gamification_progress` table

**Files:** `GamificationBadge.tsx` (new), `queries.ts`

---

### P2-2: Streak Counter
- [ ] Hitung hari berturut-turut data terkirim
- [ ] Tampilkan streak di HomeScreen
- [ ] Simpan streak di database

**Files:** `HomeScreen.tsx`, `queries.ts`

---

### P2-3: Progress Bar & Reward Screen
- [ ] Visual progress menuju milestone
- [ ] Reward screen saat unlock badge
- [ ] Animasi celebration

**Files:** `HomeScreen.tsx`, new component

---

## PHASE 3: DYNAMIC THEME

### P3-1: Theme Context/Provider
- [ ] Buat `ThemeContext.tsx` dengan dynamic color
- [ ] Warna per fase:
  - Stabil → hijau/teal
  - Manik → kuning/oranye
  - Depresi → biru gelap
- [ ] User bisa override warna manual

**Files:** `ThemeContext.tsx` (new), `App.tsx`

---

### P3-2: Apply Dynamic Theme
- [ ] Refactor semua screen pakai ThemeContext
- [ ] Ambient design: gradasi lembut, animasi halus
- [ ] Typography: font Inter/Poppins
- [ ] Cards: lebih rounded, shadow lebih soft

**Files:** Semua screen + `theme.ts`

---

## PHASE 4: ADVANCED (Fase Mendatang)

### P4-1: Kalibrasi HRV
- [ ] Flow "Kalibrasi HRV" di Settings
- [ ] Input baseline HRV dari ECG Holter/lab
- [ ] Simpan ke `circadian_baselines` table

### P4-2: Export for Doctor
- [ ] Export data (PDF/JSON) untuk dokter
- [ ] Sertakan vocal biomarker (privasi)

### P4-3: Testing Orang Normal
- [ ] Mode offline/manual input
- [ ] Log data untuk review

---

## PROGRESS LOG

| Tanggal | Aktivitas | Status |
|---|---|---|
| 21 Aug 2026 | Buat planning document | DONE |
| 21 Aug 2026 | P0-1: Settings floating (3 tab + icon gear) | DONE |
| 21 Aug 2026 | P0-2: Daily reminder di HomeScreen | DONE |
| 21 Aug 2026 | P0-3: Chart weekly & monthly (fase stabil) | DONE |
| 21 Aug 2026 | P0-4: Sembunyikan chart vocal | DONE |
| 21 Aug 2026 | P0-5: Simplifikasi HomeScreen | DONE |
| 21 Aug 2026 | P0-6: RS Jiwa & Suicide Hotline | DONE |
| | **Phase 0 SELESAI** | |
| | | |

---

## NOTES

- UI/UX referensi: **Calm Harm** app
- Kalibrasi HRV: kontak **Bu Nada Biomedik** (free)
- Test 1 minggu dengan orang normal sebelum release ke pasien
- Semua data tersimpan lokal (SQLite), tidak ada server

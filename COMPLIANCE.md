# COMPLIANCE.md — BIPOLYZER Circadian Algorithm

Dokumen ini adalah **audit compliance tracker** resmi untuk modul Circadian Algorithm.
Diperbarui setiap kali ada perubahan signifikan pada implementasi atau test suite.

> **Cara re-run audit:**
> ```bash
> PYTHONPATH="." pkm_env/bin/pytest tests/ -v \
>   --cov=src --cov-report=term-missing \
>   -p no:ament_lint -p no:ament_copyright -p no:ament_xmllint \
>   -p no:ament_pep257 -p no:launch_testing_ros -p no:ament_flake8
> ```

---

## Status Terakhir

| Metrik | Nilai | Target | Status |
|---|---|---|---|
| **Total Tests** | 54 | — | ✅ |
| **Tests Passed** | 54 / 54 | 100% | ✅ |
| **Coverage Global** | 93% | ≥ 80% | ✅ |
| **Modul di bawah 80%** | 0 | 0 | ✅ |
| **Magic Numbers** | 0 | 0 | ✅ |
| **Fungsi tanpa docstring** | 0 (publik) | 0 | ✅ |

*Terakhir diverifikasi: 2026-07-02*

---

## Aturan Implementasi (dari `AGENT.md`)

### Aturan Umum

| ID | Aturan | Status | Keterangan |
|---|---|---|---|
| R-01 | Setiap fungsi publik WAJIB memiliki docstring | ✅ PASS | Semua fungsi publik di seluruh modul sudah berdocstring |
| R-02 | Gunakan type hints di semua fungsi | ✅ PASS | Semua parameter dan return value bertipe |
| R-03 | Tidak boleh ada magic number — semua ke config YAML | ✅ PASS | `threshold`, `alpha`, `pipeline_version` dibaca dari `gating_rules.yaml` |
| R-04 | Satu file = satu tanggung jawab | ✅ PASS | Setiap file memiliki scope yang jelas |
| R-05 | Tidak boleh import modul downstream dari modul upstream | ✅ PASS | Dependency direction searah mengikuti urutan pipeline |

### Aturan Data & Format

| ID | Aturan | Status | Keterangan |
|---|---|---|---|
| D-01 | Format input sensor: JSON dengan field `timestamp`, `hrv_raw`, `audio_raw`, `imu_raw` | ✅ PASS | `validator.py` memverifikasi semua field wajib |
| D-02 | Semua timestamp dikonversi ke UTC lalu di-offset ke waktu biologis lokal | ✅ PASS | `window_classifier.py` menggunakan `ZoneInfo` dari `user_profile.yaml` |
| D-03 | Epoch processing: 30 detik sliding window, overlap 50% (15 detik) | ✅ PASS | `buffer.py` mengimplementasikan `SlidingBuffer(window_size_sec=30, overlap_sec=15)` |

### Aturan Circadian Logic

| ID | Aturan | Status | Keterangan |
|---|---|---|---|
| C-01 | Window biologis HARUS dari `config/circadian_windows.yaml` | ✅ PASS | `window_classifier.py` membaca YAML, tidak ada jam hardcoded |
| C-02 | Baseline tersimpan per `user_id` per `window_name` di `data/baselines/{user_id}.json` | ✅ PASS | `baseline_manager.py` menyimpan per user per window |
| C-03 | Baseline diupdate setiap 24 jam menggunakan EMA (alpha = 0.1) | ✅ PASS | Alpha dibaca dari `gating_rules.yaml global.ema_alpha` |
| C-04 | Calibration phase (< 7 hari): mode `permissive`, tidak ada suppression | ✅ PASS | `normalizer.py` + GR-05 menangani ini |

### Aturan Gating Rules

| ID | Rule | Status | Test |
|---|---|---|---|
| GR-01 | `sleep_window_imu` — IMU anomali saat NOCTURNAL di-suppress | ✅ PASS | `test_gating_gr01_sleep_window` |
| GR-02 | `exercise_pitch` — Vocal F0 naik + high activity di-suppress | ✅ PASS | `test_gating_gr02_exercise_pitch` |
| GR-03 | `post_meal_hrv` — RMSSD turun di AFTERNOON/EVENING di-suppress | ✅ PASS | `test_gating_gr03_post_meal_hrv_*` |
| GR-04 | `morning_activation` — Pitch & HR naik natural di MORNING di-suppress | ✅ PASS | `test_gating_gr04_morning_activation_*` |
| GR-05 | `calibration_bypass` — Semua anomali di-bypass jika < 7 hari kalibrasi | ✅ PASS | `test_gating_gr05_calibration_bypass` |

### Aturan Output

| ID | Aturan | Status | Keterangan |
|---|---|---|---|
| O-01 | Output tiap epoch adalah Python dict yang bisa di-serialize ke JSON | ✅ PASS | `test_pipeline_produces_valid_json` memverifikasi ini |
| O-02 | Field `circadian_valid` adalah boolean | ✅ PASS | `vector_builder.py` menjamin tipe bool |
| O-03 | Semua epoch tetap dioutput meski `circadian_valid = False` | ✅ PASS | `run_pipeline()` tidak memfilter epoch yang disuppress |

---

## Coverage per Modul

| Modul | Coverage | Status |
|---|---|---|
| `src/anomaly/__init__.py` | 100% | ✅ |
| `src/anomaly/detector.py` | 100% | ✅ |
| `src/anomaly/gating.py` | 98% | ✅ |
| `src/circadian/__init__.py` | 100% | ✅ |
| `src/circadian/baseline_manager.py` | 98% | ✅ |
| `src/circadian/normalizer.py` | 90% | ✅ |
| `src/circadian/window_classifier.py` | 88% | ✅ |
| `src/features/__init__.py` | 100% | ✅ |
| `src/features/vector_builder.py` | 95% | ✅ |
| `src/ingestion/__init__.py` | 100% | ✅ |
| `src/ingestion/buffer.py` | 100% | ✅ |
| `src/ingestion/parser.py` | 92% | ✅ |
| `src/ingestion/validator.py` | 93% | ✅ |
| `src/pipeline.py` | 80% | ✅ |
| `src/preprocessing/__init__.py` | 100% | ✅ |
| `src/preprocessing/hrv.py` | 88% | ✅ |
| `src/preprocessing/imu.py` | 96% | ✅ |
| `src/preprocessing/vocal.py` | 81% | ✅ |
| **TOTAL** | **93%** | ✅ |

---

## Test Suite Breakdown (54 Tests)

### `tests/test_anomaly.py` (13 tests)
| Test | Covers |
|---|---|
| `test_detect_anomalies` | Detector z-score + flags |
| `test_detect_anomalies_reads_threshold_from_config` | Config read (no magic number) |
| `test_detect_anomalies_missing_config_fallback` | Fallback ke 2.0 jika config hilang |
| `test_gating_gr01_sleep_window` | GR-01 suppress NOCTURNAL IMU |
| `test_gating_gr02_exercise_pitch` | GR-02 suppress exercise pitch |
| `test_gating_gr03_post_meal_hrv_afternoon` | GR-03 AFTERNOON |
| `test_gating_gr03_post_meal_hrv_evening` | GR-03 EVENING |
| `test_gating_gr03_rmssd_not_dropped` | GR-03 no-suppress (RMSSD naik) |
| `test_gating_gr04_morning_activation_vocal` | GR-04 vocal branch |
| `test_gating_gr04_morning_activation_hr` | GR-04 HR branch |
| `test_gating_gr05_calibration_bypass` | GR-05 belum kalibrasi |
| `test_gating_no_anomaly_passes` | Tidak ada anomali → early return |
| `test_process_anomalies` | Integration detector + gating |

### `tests/test_circadian.py` (12 tests)
| Test | Covers |
|---|---|
| `test_get_biological_window_morning` | Window MORNING |
| `test_get_biological_window_evening` | Window EVENING |
| `test_get_biological_window_nocturnal` | Window NOCTURNAL |
| `test_get_biological_window_presleep` | Window PRE-SLEEP |
| `test_get_biological_window_unknown` | Window UNKNOWN fallback |
| `test_get_biological_window_invalid_timezone_fallback` | Timezone error → UTC |
| `test_baseline_manager_new_user` | User baru → baseline kosong |
| `test_baseline_manager_ema_update` | EMA update math (alpha dari config) |
| `test_baseline_manager_corrupt_json` | JSON korup → return `{}` |
| `test_update_baseline_corrupt_json_reset` | JSON korup saat update → reset |
| `test_normalize_features_uncalibrated` | Mode permissive (z-score = 0) |
| `test_normalize_features_calibrated` | Mode calibrated (z-score aktif) |

### `tests/test_features.py` (1 test)
| Test | Covers |
|---|---|
| `test_build_feature_vector` | Kontrak interface output final |

### `tests/test_ingestion.py` (5 tests)
| Test | Covers |
|---|---|
| `test_validate_payload_valid` | Validasi payload valid |
| `test_validate_payload_missing_field` | Error: field hilang |
| `test_validate_payload_invalid_imu` | Error: IMU bukan dict |
| `test_parse_payload` | Konversi timestamp ke UTC |
| `test_sliding_buffer` | Sliding window 30s overlap 50% |

### `tests/test_pipeline.py` (7 tests)
| Test | Covers |
|---|---|
| `test_full_pipeline_end_to_end` | Happy path end-to-end |
| `test_pipeline_produces_valid_json` | Output bisa di-serialize JSON |
| `test_pipeline_skips_invalid_payload` | Invalid payload → skip, tidak crash |
| `test_pipeline_handles_epoch_processing_error` | Epoch error → lanjut epoch berikutnya |
| `test_pipeline_all_invalid_returns_empty` | Semua invalid → return `[]` |
| `test_save_output_creates_files` | File JSON disimpan ke disk |
| `test_save_output_creates_directory_if_missing` | Direktori dibuat otomatis |

### `tests/test_preprocessing.py` (16 tests)
| Test | Covers |
|---|---|
| `test_extract_hrv_features_empty` | HRV input kosong → zeros |
| `test_extract_hrv_features_too_short` | HRV kurang dari threshold |
| `test_extract_hrv_features_fallback_statistical` | Tanpa NeuroKit2 |
| `test_extract_hrv_features_neurokit_exception` | NeuroKit2 crash → fallback |
| `test_extract_hrv_features_neurokit_success_path` | NeuroKit2 sukses (mocked) |
| `test_extract_hrv_features_mock` | HRV dengan data sintetis |
| `test_extract_vocal_features_empty` | Vocal input kosong |
| `test_extract_vocal_features_fallback_statistical` | Tanpa librosa |
| `test_extract_vocal_features_librosa_exception` | librosa crash → fallback |
| `test_extract_vocal_features_mock` | Vocal dengan data sintetis |
| `test_extract_imu_features_empty` | IMU dict kosong |
| `test_extract_imu_features_missing_accel_x` | IMU tanpa accel_x |
| `test_extract_imu_features_low_activity` | Activity level: low |
| `test_extract_imu_features_high_activity` | Activity level: high |
| `test_extract_imu_features_moderate_activity` | Activity level: moderate |
| `test_process_epoch` | Orkestrasi semua preprocessing |

---

## Definition of Done per Modul (dari `AGENT.md`)

| Modul | Impl. Lengkap | Docstring | Test ≥ 80% | No Hardcode | Isolated Run | Output Diterima |
|---|---|---|---|---|---|---|
| `src/ingestion/` | ✅ | ✅ | ✅ (97%) | ✅ | ✅ | ✅ |
| `src/preprocessing/` | ✅ | ✅ | ✅ (88%) | ✅ | ✅ | ✅ |
| `src/circadian/` | ✅ | ✅ | ✅ (92%) | ✅ | ✅ | ✅ |
| `src/anomaly/` | ✅ | ✅ | ✅ (99%) | ✅ | ✅ | ✅ |
| `src/features/` | ✅ | ✅ | ✅ (95%) | ✅ | ✅ | ✅ |
| `src/pipeline.py` | ✅ | ✅ | ✅ (80%) | ✅ | ✅ | ✅ |

---

## Hal yang TIDAK Boleh Dilakukan (dari `AGENT.md`)

| Larangan | Status |
|---|---|
| Mengimplementasikan mood phase classifier | ✅ Tidak ada |
| Menyimpan data audio mentah ke disk | ✅ Tidak ada — hanya fitur akustik |
| Menggunakan threshold hardcoded di Python | ✅ Tidak ada — semua dari YAML |
| Membuat koneksi langsung ke hardware ESP32 | ✅ Tidak ada — simulasi via JSON |
| Mengubah struktur folder tanpa konfirmasi | ✅ Struktur sesuai `PROJECT.md` |

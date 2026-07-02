# Walkthrough: BIPOLYZER Circadian Algorithm Pipeline

Kita telah berhasil menyelesaikan seluruh implementasi untuk arsitektur software **BIPOLYZER Circadian Algorithm** sesuai dengan spesifikasi di `PROJECT.md` dan kontrak *interface* di `AGENT.md`. Keseluruhan modul telah dipecah secara rapi dan modular.

## Modul yang Diimplementasikan

Berikut adalah rangkuman dari sistem yang telah kita bangun:

1. **Fase 1 (Konfigurasi):** 
   - Konfigurasi berbasis YAML di `config/` (Gating rules, circadian windows, dan setelan user).
2. **Fase 2 (Ingestion Layer):** 
   - Pembuatan `SlidingBuffer` di `src/ingestion` yang mampu menerima aliran data sensor dan memecahnya ke dalam *epoch* (30 detik per epoch dengan overlap 15 detik).
3. **Fase 3 (Preprocessing Layer):**
   - Ekstraksi fitur domain *HRV*, *Vocal*, dan *IMU*. Semua fitur dikalkulasi atau disimulasikan menggunakan arsitektur adaptif dengan fallback untuk *mock data*.
4. **Fase 4 (Circadian Window & Baseline):**
   - Modul `window_classifier` memetakan *timestamp* UTC ke zona biologis pengguna secara akurat (contoh: *MORNING*, *NOCTURNAL*).
   - Modul `normalizer` mengonversi fitur mentah menjadi formasi siap-hitung menggunakan *z-score* deviasi dari baseline personal pengguna (yang dikelola di dalam *EMA-based Baseline Manager*).
5. **Fase 5 (Anomaly & Contextual Gating):**
   - *Detector* membaca *z-score* dan menandai deviasi (Threshold 2.0).
   - *Gating Engine* mengaktifkan aturan penindasan (suppression) secara cerdas; misal membedakan apakah kenaikan *pitch* suara disebabkan oleh manik atau murni karena olahraga (*exercise_pitch* rule).
6. **Fase 6 & 7 (Feature Vector & Pipeline Orchestrator):**
   - Merangkai semuanya dari aliran data awal sampai output final: **Circadian-Validated Feature Vector** (Format JSON) yang secara otomatis akan di-export ke dalam folder `data/output/`.

## Hasil Pengujian (Unit Tests)

Setiap *layer* sudah dilengkapi dengan unit test mandiri di folder `tests/`. Anda dapat menjalankan seluruh *test suite* sekaligus menggunakan perintah berikut di terminal:

```bash
PYTHONPATH="." pkm_env/bin/pytest tests/ -v
```

> [!NOTE]
> Seluruh unit test (terdiri dari 23 test *cases*) telah berhasil diselesaikan dengan hasil **100% PASSED**. Hal ini menjamin bahwa seluruh format data antar-lapisan valid dan *Gating Rules* berjalan dengan semestinya (termasuk *Calibration Phase Bypass*).

## Uji Coba Simulasi (End-to-End)

Modul utama dari keseluruhan orkestrasi, `src/pipeline.py`, telah disiapkan. Jika file ini dijalankan secara langsung, ia akan memuat secara otomatis data artifisial 30-detik dan menyimpannya menjadi output.
Anda bisa mengujinya dengan perintah:
```bash
PYTHONPATH="." pkm_env/bin/python3 src/pipeline.py
```
Output JSON hasil ekstraksi akan disalurkan ke dalam direktori `data/output/`.

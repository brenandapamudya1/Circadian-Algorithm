# Arsitektur XGBoost BIPOLYZER — HRV Realistic Dataset

> Sumber data: `notebooks/data/BIPOLYZER_HRV_XGBoost_Dataset_Realistic.xlsx` (1200 epoch, 13 kolom, 2 sheets: `MODEL_DATA` + `XGBOOST_CONFIG`) — dummy realistic sesuai `machine-learning-plan.md` vektor fitur sirkadian.  
> Render Mermaid: lihat di GitHub / `https://mermaid.live` / Expo web dengan plugin mermaid.

---

## 1. Ringkasan Dataset (MODEL_DATA)

| Fitur Mentah (13) | Tipe | Catatan Pilihan A |
|---|---|---|
| `Epoch_ID` | `str` PK `epoch_DD_WINDOW_NN` | Drop — identifier |
| `Timestamp` | `str` `Day-1..30 HH:MM` (00:00,06:00,12:00,18:00) | Drop — hanya untuk sort kronologis |
| `Circadian_Window` | `str` 4 kelas balanced 25% `MORNING/AFTERNOON/EVENING/NIGHT` (300 each) | Keep — one-hot 4 |
| `HRV_RMSSD_ms` | `float` 11–79 mean 46.24 | Keep — raw |
| `HRV_Z_Score` | `float` `0.125*RMSSD-6.25` (mean 50 std 8) | Drop redundant — pilih salah satu raw *atau* Z (r=1.0) |
| `Vocal_F0_Hz` | `float` 78–299 mean 160.97 | Keep — raw |
| `Vocal_Z_Score` | `float` `0.05556*F0-8.611` (mean155 std18) | Drop redundant |
| `IMU_Dwell_min` | `float` 0–1.92 mean0.33 | Keep — raw |
| `IMU_Z_Score` | `float` `6.667*Dwell-1.667` (mean0.25 std0.15) | Drop redundant |
| `Signal_Quality_Index` | `float` 0.5–0.978 mean0.888 | Filter only — `SQI<0.6 -> Suppressed` (20 rows), bukan fitur (leakage) |
| `Circadian_Valid` | `str` `YES 100%` | Drop — constant |
| `Suppressed` | `str` `NO 98.33% / YES 1.67%` | Drop — perfectly correlated SQI<0.6 |
| `Label_Phase` | `str` target 3 kelas `Stabil 964 (80.3%) / Risiko Manik 160 (13.3%) / Risiko Depresi 76 (6.3%)` | Target `y` |

**Pilihan A (dipakai di diagram):** keep `6 numeric` = `HRV_RMSSD, Vocal_F0, IMU_Dwell` + `3 Z` *atau* raw saja → final `3 raw + 1 one-hot window (4)` = **7 dims** (jika keep Z juga jadi 6 numeric + 4 one-hot = 10 dims, tapi redundant — diagram tunjukkan opsi drop Z). Model di `XGBOOST_CONFIG` dilatih dengan 7 dims versi Pilihan A.

**Distribusi target (imbalanced):** butuh `stratified 70/15/15` + `class_weight / SMOTE` (lihat `machine-learning-plan.md:87-88`).

---

## 2. Hyperparameter (XGBOOST_CONFIG)

| Parameter | Value | Keterangan |
|---|---|---|
| `Model` | `XGBoost Classifier` | `multi:softprob` 3 kelas |
| `n_estimators` | `200` | jumlah boosted trees |
| `max_depth` | `4` | kedalaman tiap tree |
| `learning_rate` | `0.05` | shrinkage |
| `subsample` | `0.8` | row sampling per tree |
| `colsample_bytree` | `0.8` | col sampling per tree |
| `objective` | `multi:softprob` | output prob 3 kelas |
| `train` | `70%` | 840 rows |
| `validation` | `15%` | 180 rows |
| `test` | `15%` | 180 rows |

Train/val/test stratified + `Group K-Fold by user_id` saat production (hindari leakage).

---

## 3. Diagram 1 — End-to-End Pipeline (Data → Model → On-Device)

```mermaid
graph TD
    %% Source
    A[ESP32 Raw JSON<br/>30s epoch, 15s overlap<br/>rr + aRms/aZcr + acc/gyr] --> B[Mobile Pipeline<br/>pipeline.ts / normalizer.ts]
    B --> C[Feature Vector<br/>13 cols Excel: HRV_RMSSD, Vocal_F0, IMU_Dwell<br/>+ Z_scores + Window + Label]
    
    %% Quality Filter
    C --> D{Quality Filter<br/>SQI >=0.6 ?}
    D -- No --> D1[Suppressed=YES<br/>drop 20 rows<br/>SQI 0.5-0.599]
    D -- Yes --> E[Clean Set 1180 rows<br/>SQI 0.6-0.978]
    
    %% Feature Selection Pilihan A
    E --> F[Feature Selection Pilihan A<br/>Drop: Epoch_ID, Timestamp,<br/>Circadian_Valid, Suppressed, SQI<br/>Drop redundant Z: keep raw only<br/>Keep: HRV_RMSSD, Vocal_F0, IMU_Dwell<br/>+ one-hot Circadian_Window 4]
    F --> G[Final Matrix<br/>X: 1180 x 7 dims<br/>y: Label_Phase 3 kelas<br/>Stabil 80% / Manik 13% / Depresi 6%]
    
    %% Split
    G --> H{Stratified Split<br/>70/15/15<br/>seed 42}
    H --> H1[Train 840<br/>Stabil 675 / Manik 112 / Depresi 53]
    H --> H2[Val 180<br/>Stabil 144 / Manik 24 / Depresi 12]
    H --> H3[Test 180<br/>Stabil 144 / Manik 24 / Depresi 12]
    
    %% Training
    H1 --> I[XGBoost Classifier<br/>200 trees / depth 4 / lr 0.05<br/>subsample 0.8 / colsample 0.8<br/>multi:softprob<br/>class_weight balanced]
    H2 -.->|early stopping<br/>logloss| I
    I --> J[Trained Model<br/>994KB]
    
    %% Eval
    J --> K{Eval on Test}
    K --> K1[Confusion Matrix 3x3]
    K --> K2[F1 macro / AUC OvR<br/>Feature Importance]
    K --> K3[Threshold Softprob]
    
    %% Deploy
    J --> L[Export ONNX<br/>skl2onnx / onnxmltools<br/>.onnx ~400KB]
    L --> M[Mobile Embed<br/>onnxruntime-react-native<br/>Offline inference]
    M --> N[Real-time Pred<br/>Stabil / Risiko Manik / Risiko Depresi<br/>per 30s epoch]
    
    %% Style
    classDef drop fill:#ffdddd,stroke:#cc0000
    classDef keep fill:#ddffdd,stroke:#009900
    class D1 drop
    class F,G,J keep
```

**Catatan:**
- `WORKFLOW.md` sudah punya graph ingestion `validator -> buffer -> preprocessing -> circadian -> gating`; diagram di atas melanjutkan dari `Feature Vector` ke ML, tidak duplikasi.
- Jika butuh 5 window (`NOCTURNAL/PRE-SLEEP`) mapping: `NIGHT -> NOCTURNAL` di `window_classifier.py`.

---

## 4. Diagram 2 — Internal XGBoost Ensemble (Pilihan A)

```mermaid
graph LR
    subgraph Input ["Input Layer — 7 dims"]
        direction TB
        F1[HRV_RMSSD_ms<br/>float 11-79]
        F2[Vocal_F0_Hz<br/>float 78-299]
        F3[IMU_Dwell_min<br/>float 0-1.92]
        F4[Window_MORNING<br/>0/1]
        F5[Window_AFTERNOON<br/>0/1]
        F6[Window_EVENING<br/>0/1]
        F7[Window_NIGHT<br/>0/1]
    end

    subgraph Boosting ["Gradient Boosting — 200 Estimators Sequential"]
        direction TB
        T1[Tree 1<br/>depth 4<br/>split: Vocal_F0 >180?<br/>IMU_Dwell >0.6?]
        T2[Tree 2<br/>depth 4<br/>residual fit<br/>HRV_RMSSD <35?]
        T3[Tree 3..199<br/>...<br/>subsample 0.8<br/>colsample 0.8]
        T200[Tree 200<br/>depth 4<br/>lr 0.05 shrinkage]
        T1 --> T2 --> T3 --> T200
    end

    Input --> Boosting

    Boosting --> SUM[Sum Leaf Weights<br/>per class<br/>logits 3]
    SUM --> SM[Softmax<br/>multi:softprob]
    SM --> P0[Prob Stabil<br/>0.0-1.0]
    SM --> P1[Prob Risiko Manik<br/>0.0-1.0]
    SM --> P2[Prob Risiko Depresi<br/>0.0-1.0]
    P0 & P1 & P2 --> ARG[Argmax<br/>Pred Label]

    ARG --> O0[Stabil<br/>HRV~50, F0~155, Dwell~0.25]
    ARG --> O1[Risiko Manik<br/>HRV~28 low, F0~220 high,<br/>Dwell~0.9 high]
    ARG --> O2[Risiko Depresi<br/>HRV~35 low, F0~114 low,<br/>Dwell~0.13 low]

    subgraph Explain ["Explainability"]
        IMP[Feature Importance<br/>Gain / SHAP<br/>Vocal_F0 > IMU_Dwell > HRV_RMSSD<br/>Window_NIGHT strong for Manik]
    end
    Boosting -.-> IMP

    classDef input fill:#e3f2fd,stroke:#1976d2
    classDef tree fill:#fff3e0,stroke:#ef6c00
    classDef out fill:#e8f5e9,stroke:#2e7d32
    class F1,F2,F3,F4,F5,F6,F7 input
    class T1,T2,T3,T200 tree
    class O0,O1,O2 out
```

**Bacaan diagram:**
- Tiap tree depth 4 → max 16 leaves, split kriteria dipelajari dari distribusi di `MODEL_DATA`: Manik = `Vocal_F0 high + IMU_Dwell high + HRV low`, Depresi = `Vocal low + IMU low + HRV low`, Stabil = sekitar baseline `HRV 50 / F0 155 / Dwell 0.25`.
- `subsample 0.8` + `colsample 0.8` cegah overfit pada 1200 rows imbalanced.
- Output softprob memungkinkan threshold tuning (misal `Manik >0.4` lebih sensitif).

---

## 5. Mapping File → Fitur → Model

```mermaid
flowchart TD
    Excel[Excel MODEL_DATA<br/>A1:M1201<br/>1200 rows] --> Raw[Raw Cols 10 numeric+cat]
    Raw --> Sel{Selection Pilihan A}
    Sel -- Drop --> Dropped[Epoch_ID, Timestamp,<br/>HRV_Z, Vocal_Z, IMU_Z,<br/>SQI, Suppressed, Circadian_Valid]
    Sel -- Keep --> Kept[HRV_RMSSD, Vocal_F0, IMU_Dwell,<br/>Circadian_Window]
    Kept --> Enc[One-Hot Window 4<br/>MORNING/AFTERNOON/EVENING/NIGHT]
    Enc --> X[X 7 dims float32]
    X --> Y[y Label_Phase 0:Stabil 1:Manik 2:Depresi]
    X & Y --> Model[XGBoost 200x4 lr0.05]
```

---

## 6. Roadmap Deployment (dari `machine-learning-plan.md:94-102`)

```mermaid
graph LR
    A[Feature Vector CSV/Parquet<br/>export dari pipeline.ts] --> B[Python Train<br/>scikit-learn + xgboost<br/>notebooks/04_xgboost_simulation.ipynb]
    B --> C[ONNX Export<br/>skl2onnx<br/>bipolyzer_xgb.onnx]
    C --> D[Mobile Assets<br/>assets/models/]
    D --> E[ONNX Runtime RN<br/>onnxruntime-react-native<br/>inference offline]
    E --> F[UI HomeScreen<br/>Fase: Stabil / Risiko<br/>per window]
```

---

## 7. Validasi & Next Step

- **Group K-Fold by `user_id` / `Day`** (bukan shuffle epoch) untuk simulasi generalisasi user baru — sesuai `machine-learning-plan.md:84-86`.
- **Imbalance:** gunakan `scale_pos_weight` atau `SMOTE` pada Train 840, evaluasi dengan `F1-macro` bukan accuracy (baseline 80% jika tebak Stabil).
- **Uji realistic:** periksa run-length label per `Day` — dataset saat ini fragmented (maks run pendek, bukan episode multi-hari) — untuk production butuh labeling EMA `HDRS/YMRS` + psikiater.

> File ini siap di-render di overview. Untuk preview: `npx @mermaid-js/mermaid-cli -i docs/xgboost-architecture.md -o docs/xgboost-architecture.svg` atau buka di `mermaid.live`.

import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from src.preprocessing.hrv import extract_hrv_features
from src.preprocessing.vocal import extract_vocal_features
from src.preprocessing.imu import extract_imu_features
from src.preprocessing import process_epoch


# hrv

def test_extract_hrv_features_empty():
    res = extract_hrv_features([])
    assert res["rmssd"] == 0.0
    assert res["sdnn"] == 0.0


def test_extract_hrv_features_too_short():
    """Kurang dari sampling_rate*5 sampel → fallback statistik, bukan crash."""
    raw = [1.0, 2.0, 3.0]
    res = extract_hrv_features(raw)
    assert res["rmssd"] == 0.0  # < minimum threshold → returns zeros


def test_extract_hrv_features_fallback_statistical():
    """Tanpa neurokit2 atau saat neurokit gagal → fallback statistik berjalan."""
    raw = [float(i % 10) for i in range(500)]
    # Paksa branch fallback: patch NEUROKIT_AVAILABLE = False
    with patch("src.preprocessing.hrv.NEUROKIT_AVAILABLE", False):
        res = extract_hrv_features(raw)
    assert "rmssd" in res
    assert "sdnn" in res
    assert res["mean_hr"] == 75.0  # fallback default


def test_extract_hrv_features_neurokit_exception():
    """Jika neurokit melempar exception → harus fallback ke statistik tanpa crash."""
    raw = [float(i % 10) for i in range(500)]
    with patch("src.preprocessing.hrv.NEUROKIT_AVAILABLE", True), \
         patch("src.preprocessing.hrv.nk") as mock_nk:
        mock_nk.ppg_process.side_effect = Exception("neurokit error")
        res = extract_hrv_features(raw)
    assert "rmssd" in res


def test_extract_hrv_features_neurokit_success_path():
    """Test NeuroKit2 sukses: mock return valid DataFrame dengan kolom HRV."""
    import pandas as pd
    raw = [float(i % 10) for i in range(500)]

    mock_hrv_df = pd.DataFrame({
        "HRV_RMSSD": [42.0],
        "HRV_SDNN": [35.0],
        "HRV_MeanNN": [800.0],
        "HRV_pNN50": [25.0],
    })
    mock_signals = pd.DataFrame({"PPG_Clean": raw})
    mock_info = {"PPG_Peaks": [50, 150, 250, 350, 450]}

    with patch("src.preprocessing.hrv.NEUROKIT_AVAILABLE", True), \
         patch("src.preprocessing.hrv.nk") as mock_nk:
        mock_nk.ppg_process.return_value = (mock_signals, mock_info)
        mock_nk.hrv_time.return_value = mock_hrv_df
        res = extract_hrv_features(raw)

    assert "rmssd" in res
    assert res["rmssd"] == 42.0
    assert res["sdnn"] == 35.0


def test_extract_hrv_features_mock():
    raw = [float(i % 10) for i in range(500)]
    res = extract_hrv_features(raw)
    assert "rmssd" in res
    assert "mean_hr" in res


# vocal

def test_extract_vocal_features_empty():
    res = extract_vocal_features([])
    assert res["f0_mean"] == 0.0


def test_extract_vocal_features_fallback_statistical():
    """Tanpa librosa → fallback statistik berjalan."""
    raw = [float(np.sin(i)) for i in range(16000)]
    with patch("src.preprocessing.vocal.LIBROSA_AVAILABLE", False):
        res = extract_vocal_features(raw)
    assert "f0_mean" in res
    assert "speech_rate" in res
    assert res["speech_rate"] == 0.5  # fallback value


def test_extract_vocal_features_librosa_exception():
    """Jika librosa melempar exception → harus fallback ke statistik tanpa crash."""
    raw = [float(np.sin(i)) for i in range(16000)]
    with patch("src.preprocessing.vocal.LIBROSA_AVAILABLE", True), \
         patch("src.preprocessing.vocal.librosa") as mock_lib:
        mock_lib.pyin.side_effect = Exception("librosa error")
        res = extract_vocal_features(raw)
    assert "f0_mean" in res


def test_extract_vocal_features_mock():
    raw = [float(np.sin(i)) for i in range(16000)]
    res = extract_vocal_features(raw)
    assert "f0_mean" in res
    assert "speech_rate" in res


# imu

def test_extract_imu_features_empty():
    res = extract_imu_features({})
    assert res["activity_level"] == "low"


def test_extract_imu_features_missing_accel_x():
    """IMU dict ada tapi accel_x kosong → return default low."""
    res = extract_imu_features({"accel_x": []})
    assert res["activity_level"] == "low"


def test_extract_imu_features_low_activity():
    imu = {
        "accel_x": [0.0] * 100,
        "accel_y": [0.0] * 100,
        "accel_z": [9.8] * 100,
    }
    res = extract_imu_features(imu)
    assert res["activity_level"] == "low"
    assert res["dwell_minutes"] == 0.5
    assert res["posture_transitions"] == 0


def test_extract_imu_features_high_activity():
    imu = {
        "accel_x": [0.0] * 100,
        "accel_y": [0.0] * 100,
        "accel_z": [float(i % 2 * 20) for i in range(100)],
    }
    res = extract_imu_features(imu)
    assert res["activity_level"] in ["moderate", "high"]


def test_extract_imu_features_moderate_activity():
    """Variance antara 1.0 dan 5.0 → moderate."""
    # ax=0, ay=0, az alternates 0.0/3.0 → magnitude alternates 0.0/3.0
    # variance of magnitude ≈ 2.25 → masuk range moderate (1.0 < var ≤ 5.0)
    imu = {
        "accel_x": [0.0] * 100,
        "accel_y": [0.0] * 100,
        "accel_z": [0.0 if i % 2 == 0 else 3.0 for i in range(100)],
    }
    res = extract_imu_features(imu)
    assert res["activity_level"] == "moderate"


# process_epoch

def test_process_epoch():
    epoch = {
        "epoch_id": "uuid-1234",
        "timestamp_start": "2026-07-01T10:00:00Z",
        "timestamp_end": "2026-07-01T10:00:30Z",
        "user_id": "user1",
        "hrv_raw": [],
        "audio_raw": [],
        "imu_raw": {}
    }
    res = process_epoch(epoch)

    assert res["epoch_id"] == "uuid-1234"
    assert res["timestamp"] == "2026-07-01T10:00:00Z"
    assert res["user_id"] == "user1"
    assert "hrv" in res
    assert "vocal" in res
    assert "imu" in res
    assert res["imu"]["activity_level"] == "low"

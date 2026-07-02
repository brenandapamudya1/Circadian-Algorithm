import pytest
import numpy as np
from src.preprocessing.hrv import extract_hrv_features
from src.preprocessing.vocal import extract_vocal_features
from src.preprocessing.imu import extract_imu_features
from src.preprocessing import process_epoch

def test_extract_hrv_features_empty():
    res = extract_hrv_features([])
    assert res["rmssd"] == 0.0
    assert res["sdnn"] == 0.0
    
def test_extract_hrv_features_mock():
    # Provide synthetic data
    raw = [float(i % 10) for i in range(500)]
    res = extract_hrv_features(raw)
    assert "rmssd" in res
    assert "mean_hr" in res
    
def test_extract_vocal_features_empty():
    res = extract_vocal_features([])
    assert res["f0_mean"] == 0.0
    
def test_extract_vocal_features_mock():
    # Provide synthetic data
    raw = [float(np.sin(i)) for i in range(16000)]
    res = extract_vocal_features(raw)
    assert "f0_mean" in res
    assert "speech_rate" in res

def test_extract_imu_features_empty():
    res = extract_imu_features({})
    assert res["activity_level"] == "low"

def test_extract_imu_features_low_activity():
    # Gravity only, no variance
    imu = {
        "accel_x": [0.0]*100,
        "accel_y": [0.0]*100,
        "accel_z": [9.8]*100,
    }
    res = extract_imu_features(imu)
    assert res["activity_level"] == "low"
    assert res["dwell_minutes"] == 0.5
    assert res["posture_transitions"] == 0

def test_extract_imu_features_high_activity():
    # High variance
    imu = {
        "accel_x": [0.0]*100,
        "accel_y": [0.0]*100,
        "accel_z": [float(i % 2 * 20) for i in range(100)],
    }
    res = extract_imu_features(imu)
    # The variance of magnitude will be calculated, let's just check it runs and outputs correctly
    assert res["activity_level"] in ["moderate", "high"]
    
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

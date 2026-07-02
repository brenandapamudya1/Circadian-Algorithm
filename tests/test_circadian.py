import pytest
import os
import json
from datetime import datetime, timezone, timedelta
from src.circadian.window_classifier import get_biological_window
from src.circadian.baseline_manager import get_baseline, update_baseline, BASELINE_DIR
from src.circadian.normalizer import normalize_features

def test_get_biological_window():
    # 03:00 UTC with Asia/Jakarta (+7) is 10:00 Local -> MORNING
    window = get_biological_window("2026-07-01T03:00:00Z")
    assert window == "MORNING"
    
    # 10:00 UTC with Asia/Jakarta (+7) is 17:00 Local -> EVENING
    window = get_biological_window("2026-07-01T10:00:00Z")
    assert window == "EVENING"
    
def test_baseline_manager():
    user_id = "test_user_circadian"
    window = "MORNING"
    
    # Clean up file if exists
    file_path = BASELINE_DIR / f"{user_id}.json"
    if file_path.exists():
        os.remove(file_path)
        
    baseline = get_baseline(user_id, window)
    assert baseline == {}
    
    # Add new baseline
    new_features = {
        "hrv": {"rmssd": 50.0},
        "vocal": {"f0_mean": 120.0},
        "imu": {"activity_level": "moderate"} # String should be skipped for math
    }
    update_baseline(user_id, window, new_features)
    
    updated = get_baseline(user_id, window)
    assert "hrv" in updated
    assert updated["hrv"]["rmssd"]["mean"] == 50.0
    
    # Clean up
    if file_path.exists():
        os.remove(file_path)

def test_normalize_features():
    epoch = {
        "epoch_id": "test-id",
        "timestamp": "2026-07-01T03:00:00Z", # Morning in +7
        "user_id": "test_user_circadian",
        "hrv": {"rmssd": 60.0},
        "vocal": {"f0_mean": 120.0},
        "imu": {"activity_level": "moderate"}
    }
    
    norm = normalize_features(epoch)
    assert norm["window"] == "MORNING"
    assert norm["is_calibrated"] is False # Calibration is 2026-07-01, day 0
    assert norm["calibration_day"] == 0
    
    # Z-scores should be 0 because it's not calibrated yet
    assert norm["hrv_normalized"]["rmssd"]["zscore"] == 0.0
    
    # Activity level just returns value
    assert norm["imu_normalized"]["activity_level"]["value"] == "moderate"

def test_normalize_features_calibrated():
    # 10 days later
    epoch = {
        "epoch_id": "test-id",
        "timestamp": "2026-07-11T03:00:00Z",
        "user_id": "test_user_circadian",
        "hrv": {"rmssd": 60.0},
        "vocal": {"f0_mean": 120.0},
        "imu": {}
    }
    
    norm = normalize_features(epoch)
    assert norm["is_calibrated"] is True
    assert norm["calibration_day"] == 10

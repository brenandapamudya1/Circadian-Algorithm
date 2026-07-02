import pytest
from src.anomaly import process_anomalies
from src.anomaly.detector import detect_anomalies
from src.anomaly.gating import apply_gating_rules

def test_detect_anomalies():
    epoch = {
        "hrv_normalized": {"rmssd": {"zscore": 2.5}},
        "vocal_normalized": {"f0_mean": {"zscore": -1.0}},
        "imu_normalized": {"dwell_minutes": {"zscore": 0.5}}
    }
    
    res = detect_anomalies(epoch, threshold=2.0)
    assert res["hrv_zscore"] == 2.5
    assert res["vocal_zscore"] == 1.0 # absolute value
    assert res["anomaly_flags"]["hrv_anomaly"] is True
    assert res["anomaly_flags"]["vocal_anomaly"] is False

def test_gating_gr01_sleep_window():
    epoch = {
        "window": "NOCTURNAL",
        "anomaly_flags": {"imu_anomaly": True},
        "is_calibrated": True
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "sleep_window_imu"

def test_gating_gr02_exercise_pitch():
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "anomaly_flags": {"vocal_anomaly": True},
        "vocal_normalized": {"f0_mean": {"value": 150, "baseline_mean": 100}}, # Increased
        "imu_normalized": {"activity_level": {"value": "high"}}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "exercise_pitch"

def test_gating_gr05_calibration_bypass():
    epoch = {
        "window": "NOCTURNAL",
        "anomaly_flags": {"imu_anomaly": True},
        "is_calibrated": False # NOT CALIBRATED -> BYPASS
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is True
    assert reason is None

def test_process_anomalies():
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "hrv_normalized": {"rmssd": {"zscore": 3.0, "value": 10, "baseline_mean": 30}}, # Dropped, but window Morning
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    # Has HRV anomaly, but no morning activation conditions match (f0/HR didn't increase, RMSSD doesn't trigger GR-04)
    # Wait, GR-04 says if HRV anomaly and hr_val > hr_mean. We didn't provide HR. So it passes.
    res = process_anomalies(epoch)
    assert res["anomaly_flags"]["hrv_anomaly"] is True
    assert res["gating_passed"] is True

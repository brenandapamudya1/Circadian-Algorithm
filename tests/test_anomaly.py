import pytest
import os
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from src.anomaly import process_anomalies
from src.anomaly.detector import detect_anomalies, _load_global_config
from src.anomaly.gating import apply_gating_rules


# detector tests

def test_detect_anomalies():
    epoch = {
        "hrv_normalized": {"rmssd": {"zscore": 2.5}},
        "vocal_normalized": {"f0_mean": {"zscore": -1.0}},
        "imu_normalized": {"dwell_minutes": {"zscore": 0.5}}
    }

    res = detect_anomalies(epoch, threshold=2.0)
    assert res["hrv_zscore"] == 2.5
    assert res["vocal_zscore"] == 1.0  # absolute value
    assert res["anomaly_flags"]["hrv_anomaly"] is True
    assert res["anomaly_flags"]["vocal_anomaly"] is False


def test_detect_anomalies_reads_threshold_from_config():
    """Pastikan threshold=None membaca dari config YAML (tidak hardcoded)."""
    epoch = {
        "hrv_normalized": {"rmssd": {"zscore": 2.5}},
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    res = detect_anomalies(epoch)  # threshold=None → baca dari config
    assert res["anomaly_flags"]["hrv_anomaly"] is True


def test_detect_anomalies_missing_config_fallback():
    """Jika config tidak ada, harus fallback ke threshold 2.0."""
    from pathlib import Path
    with patch("src.anomaly.detector.PROJECT_ROOT", Path("/nonexistent/path")):
        cfg = _load_global_config()
    assert cfg == {}


# gating GR-01

def test_gating_gr01_sleep_window():
    epoch = {
        "window": "NOCTURNAL",
        "anomaly_flags": {"imu_anomaly": True},
        "is_calibrated": True
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "sleep_window_imu"


# gating GR-02

def test_gating_gr02_exercise_pitch():
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "anomaly_flags": {"vocal_anomaly": True},
        "vocal_normalized": {"f0_mean": {"value": 150, "baseline_mean": 100}},
        "imu_normalized": {"activity_level": {"value": "high"}}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "exercise_pitch"


# gating GR-03

def test_gating_gr03_post_meal_hrv_afternoon():
    """GR-03: HRV anomali + RMSSD turun di AFTERNOON harus di-suppress."""
    epoch = {
        "window": "AFTERNOON",
        "is_calibrated": True,
        "anomaly_flags": {"hrv_anomaly": True, "vocal_anomaly": False, "imu_anomaly": False},
        "hrv_normalized": {
            "rmssd": {"value": 20.0, "baseline_mean": 50.0, "zscore": 3.0}
        },
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "post_meal_hrv"


def test_gating_gr03_post_meal_hrv_evening():
    """GR-03 juga berlaku di EVENING window."""
    epoch = {
        "window": "EVENING",
        "is_calibrated": True,
        "anomaly_flags": {"hrv_anomaly": True, "vocal_anomaly": False, "imu_anomaly": False},
        "hrv_normalized": {
            "rmssd": {"value": 10.0, "baseline_mean": 55.0, "zscore": 3.0}
        },
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "post_meal_hrv"


def test_gating_gr03_rmssd_not_dropped():
    """GR-03: RMSSD naik (bukan turun) → tidak di-suppress."""
    epoch = {
        "window": "AFTERNOON",
        "is_calibrated": True,
        "anomaly_flags": {"hrv_anomaly": True, "vocal_anomaly": False, "imu_anomaly": False},
        "hrv_normalized": {
            "rmssd": {"value": 80.0, "baseline_mean": 50.0, "zscore": 3.0}
        },
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is True
    assert reason is None


# gating GR-04

def test_gating_gr04_morning_activation_vocal():
    """GR-04: Vocal anomali + F0 naik di MORNING → suppress."""
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "anomaly_flags": {"vocal_anomaly": True, "hrv_anomaly": False, "imu_anomaly": False},
        "vocal_normalized": {
            "f0_mean": {"value": 200.0, "baseline_mean": 120.0, "zscore": 3.0}
        },
        "hrv_normalized": {
            "mean_hr": {"value": 70.0, "baseline_mean": 70.0, "zscore": 0.0}
        },
        "imu_normalized": {}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "morning_activation"


def test_gating_gr04_morning_activation_hr():
    """GR-04: HR anomali + HR naik di MORNING → suppress."""
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "anomaly_flags": {"vocal_anomaly": False, "hrv_anomaly": True, "imu_anomaly": False},
        "vocal_normalized": {
            "f0_mean": {"value": 100.0, "baseline_mean": 120.0, "zscore": 0.0}
        },
        "hrv_normalized": {
            "mean_hr": {"value": 95.0, "baseline_mean": 70.0, "zscore": 3.0}
        },
        "imu_normalized": {}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is False
    assert reason == "morning_activation"


# gating GR-05

def test_gating_gr05_calibration_bypass():
    epoch = {
        "window": "NOCTURNAL",
        "anomaly_flags": {"imu_anomaly": True},
        "is_calibrated": False  # NOT CALIBRATED → BYPASS
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is True
    assert reason is None


# no anomaly path

def test_gating_no_anomaly_passes():
    """Jika tidak ada anomali sama sekali, langsung return True tanpa evaluasi rules."""
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "anomaly_flags": {"hrv_anomaly": False, "vocal_anomaly": False, "imu_anomaly": False},
        "hrv_normalized": {},
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    passed, reason = apply_gating_rules(epoch)
    assert passed is True
    assert reason is None


# process_anomalies integration

def test_process_anomalies():
    epoch = {
        "window": "MORNING",
        "is_calibrated": True,
        "hrv_normalized": {"rmssd": {"zscore": 3.0, "value": 10, "baseline_mean": 30}},
        "vocal_normalized": {},
        "imu_normalized": {}
    }
    res = process_anomalies(epoch)
    assert res["anomaly_flags"]["hrv_anomaly"] is True
    assert res["gating_passed"] is True

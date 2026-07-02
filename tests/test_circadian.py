import pytest
import os
import json
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
from src.circadian.window_classifier import get_biological_window
from src.circadian.baseline_manager import get_baseline, update_baseline, BASELINE_DIR
from src.circadian.normalizer import normalize_features


# ── window_classifier ──────────────────────────────────────────────────────────

def test_get_biological_window_morning():
    # 03:00 UTC + Asia/Jakarta (+7) = 10:00 Local → MORNING
    window = get_biological_window("2026-07-01T03:00:00Z")
    assert window == "MORNING"


def test_get_biological_window_evening():
    # 10:00 UTC + Asia/Jakarta (+7) = 17:00 Local → EVENING
    window = get_biological_window("2026-07-01T10:00:00Z")
    assert window == "EVENING"


def test_get_biological_window_nocturnal():
    # 19:00 UTC + Asia/Jakarta (+7) = 02:00 Local → NOCTURNAL
    window = get_biological_window("2026-07-01T19:00:00Z")
    assert window == "NOCTURNAL"


def test_get_biological_window_presleep():
    # 15:00 UTC + Asia/Jakarta (+7) = 22:00 Local → PRE-SLEEP
    window = get_biological_window("2026-07-01T15:00:00Z")
    assert window == "PRE-SLEEP"


def test_get_biological_window_unknown():
    """Timestamp yang tidak jatuh di window mana pun harus return 'UNKNOWN'."""
    # Mock windows yang kosong agar tidak ada yang cocok
    with patch("src.circadian.window_classifier.load_config") as mock_cfg:
        mock_cfg.return_value = {"windows": {}}
        window = get_biological_window("2026-07-01T10:00:00Z")
    assert window == "UNKNOWN"


def test_get_biological_window_invalid_timezone_fallback():
    """Timezone string tidak valid harus fallback ke UTC tanpa crash."""
    with patch("src.circadian.window_classifier.load_config") as mock_cfg:
        def side_effect(file_name):
            if file_name == "user_profile.yaml":
                return {"timezone": "Invalid/Timezone_XYZ"}
            # Return normal windows config
            return {
                "windows": {
                    "MORNING": {"start": "06:00:00", "end": "11:59:59"},
                }
            }
        mock_cfg.side_effect = side_effect
        # Should not raise — must fallback gracefully
        window = get_biological_window("2026-07-01T08:00:00+00:00")
    assert isinstance(window, str)


# ── baseline_manager ───────────────────────────────────────────────────────────

def test_baseline_manager_new_user():
    user_id = "test_user_circadian"
    window = "MORNING"

    file_path = BASELINE_DIR / f"{user_id}.json"
    if file_path.exists():
        os.remove(file_path)

    baseline = get_baseline(user_id, window)
    assert baseline == {}

    # Add new baseline
    new_features = {
        "hrv": {"rmssd": 50.0},
        "vocal": {"f0_mean": 120.0},
        "imu": {"activity_level": "moderate"}  # String → harus dilewati untuk math
    }
    update_baseline(user_id, window, new_features)

    updated = get_baseline(user_id, window)
    assert "hrv" in updated
    assert updated["hrv"]["rmssd"]["mean"] == 50.0

    if file_path.exists():
        os.remove(file_path)


def test_baseline_manager_ema_update():
    """Test bahwa EMA update berjalan dengan benar (alpha dari config)."""
    user_id = "test_ema_user"
    window = "EVENING"

    file_path = BASELINE_DIR / f"{user_id}.json"
    if file_path.exists():
        os.remove(file_path)

    # Update pertama → initializes baseline dengan mean = 50.0
    update_baseline(user_id, window, {"hrv": {"rmssd": 50.0}})
    # Update kedua → EMA: new_mean = 0.1 * 60 + 0.9 * 50 = 6 + 45 = 51.0
    update_baseline(user_id, window, {"hrv": {"rmssd": 60.0}})

    updated = get_baseline(user_id, window)
    assert abs(updated["hrv"]["rmssd"]["mean"] - 51.0) < 0.01

    if file_path.exists():
        os.remove(file_path)


def test_baseline_manager_corrupt_json():
    """File baseline korup harus return dict kosong tanpa crash."""
    user_id = "corrupt_user"
    window = "MORNING"

    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    file_path = BASELINE_DIR / f"{user_id}.json"
    file_path.write_text("{invalid json!!}")

    result = get_baseline(user_id, window)
    assert result == {}

    if file_path.exists():
        os.remove(file_path)


def test_update_baseline_corrupt_json_reset():
    """update_baseline pada file korup harus reset ke baseline baru tanpa crash."""
    user_id = "corrupt_update_user"
    window = "MORNING"

    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    file_path = BASELINE_DIR / f"{user_id}.json"
    file_path.write_text("{not valid")

    # Tidak boleh crash — harus reset dan tulis ulang
    update_baseline(user_id, window, {"hrv": {"rmssd": 45.0}})

    updated = get_baseline(user_id, window)
    assert updated["hrv"]["rmssd"]["mean"] == 45.0

    if file_path.exists():
        os.remove(file_path)


# ── normalizer ─────────────────────────────────────────────────────────────────

def test_normalize_features_uncalibrated():
    epoch = {
        "epoch_id": "test-id",
        "timestamp": "2026-07-01T03:00:00Z",  # Morning in +7
        "user_id": "test_user_circadian",
        "hrv": {"rmssd": 60.0},
        "vocal": {"f0_mean": 120.0},
        "imu": {"activity_level": "moderate"}
    }

    norm = normalize_features(epoch)
    assert norm["window"] == "MORNING"
    assert norm["is_calibrated"] is False  # day 0
    assert norm["calibration_day"] == 0
    # Z-scores must be 0 when not calibrated
    assert norm["hrv_normalized"]["rmssd"]["zscore"] == 0.0
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

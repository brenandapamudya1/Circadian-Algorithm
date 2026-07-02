from src.features import build_feature_vector

def test_build_feature_vector():
    epoch = {
        "epoch_id": "test-uuid",
        "timestamp": "2026-07-01T10:00:00Z",
        "user_id": "user1",
        "window": "MORNING",
        "hrv_normalized": {
            "rmssd": {"value": 50.0},
            "sdnn": {"value": 40.0}
        },
        "vocal_normalized": {
            "f0_mean": {"value": 120.0},
            "speech_rate": {"value": 4.5}
        },
        "imu_normalized": {
            "dwell_minutes": {"value": 0.2},
            "posture_transitions": {"value": 2}
        },
        "hrv_zscore": 2.5,
        "vocal_zscore": 1.0,
        "imu_zscore": 0.5,
        "gating_passed": False,
        "suppressed_reason": "morning_activation"
    }
    
    fv = build_feature_vector(epoch)
    
    assert fv["epoch_id"] == "test-uuid"
    assert fv["hrv"]["rmssd"] == 50.0
    assert fv["hrv"]["zscore"] == 2.5
    assert fv["vocal"]["f0"] == 120.0
    assert fv["imu"]["dwell_min"] == 0.2
    assert fv["circadian_valid"] is False
    assert fv["suppressed_reason"] == "morning_activation"
    assert "pipeline_version" in fv

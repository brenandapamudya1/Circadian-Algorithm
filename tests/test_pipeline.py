import pytest
from src.pipeline import run_pipeline
from datetime import datetime, timezone, timedelta

def test_full_pipeline_end_to_end():
    start_time = datetime(2026, 7, 1, 10, 0, 0, tzinfo=timezone.utc)
    mock_payloads = []
    
    for i in range(46):
        dt = start_time + timedelta(seconds=i)
        mock_payloads.append({
            "timestamp": dt.isoformat(timespec='milliseconds'),
            "user_id": "test_user_pipeline",
            "hrv_raw": [float(i)],
            "audio_raw": [float(i)],
            "imu_raw": {
                "accel_x": [0.0], "accel_y": [0.0], "accel_z": [9.8],
                "gyro_x": [0.0], "gyro_y": [0.0], "gyro_z": [0.0]
            }
        })
        
    results = run_pipeline(mock_payloads)
    
    assert len(results) == 2
    fv = results[0]
    
    assert "epoch_id" in fv
    assert fv["user_id"] == "test_user_pipeline"
    assert "window" in fv
    assert "circadian_valid" in fv
    assert "pipeline_version" in fv
    
    assert "hrv" in fv
    assert "vocal" in fv
    assert "imu" in fv

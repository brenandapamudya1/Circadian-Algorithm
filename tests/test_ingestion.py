import pytest
from datetime import datetime, timedelta, timezone
from src.ingestion.validator import validate_payload
from src.ingestion.parser import parse_payload
from src.ingestion.buffer import SlidingBuffer

def test_validate_payload_valid():
    payload = {
        "timestamp": "2026-07-01T10:00:00Z",
        "user_id": "user1",
        "hrv_raw": [1.0, 2.0],
        "audio_raw": [0.1, 0.2],
        "imu_raw": {
            "accel_x": [0.0], "accel_y": [0.0], "accel_z": [9.8],
            "gyro_x": [0.0], "gyro_y": [0.0], "gyro_z": [0.0]
        }
    }
    assert validate_payload(payload) is True

def test_validate_payload_missing_field():
    payload = {
        "timestamp": "2026-07-01T10:00:00Z"
    }
    with pytest.raises(ValueError, match="Missing required field"):
        validate_payload(payload)

def test_validate_payload_invalid_imu():
    payload = {
        "timestamp": "2026-07-01T10:00:00Z",
        "user_id": "user1",
        "hrv_raw": [],
        "audio_raw": [],
        "imu_raw": []  # Should be dict
    }
    with pytest.raises(ValueError, match="imu_raw must be a dictionary"):
        validate_payload(payload)

def test_parse_payload():
    payload = {
        "timestamp": "2026-07-01T10:00:00Z",
        "user_id": "user1",
        "hrv_raw": [], "audio_raw": [], "imu_raw": {}
    }
    parsed = parse_payload(payload)
    assert parsed["timestamp"] == "2026-07-01T10:00:00.000+00:00"

def test_sliding_buffer():
    buffer = SlidingBuffer(window_size_sec=30, overlap_sec=15)
    
    start_time = datetime(2026, 7, 1, 10, 0, 0, tzinfo=timezone.utc)
    
    # Add 46 seconds of data (1 point per second, up to 10:00:45)
    for i in range(46):
        dt = start_time + timedelta(seconds=i)
        payload = {
            "timestamp": dt.isoformat(timespec='milliseconds'),
            "user_id": "user1",
            "hrv_raw": [float(i)],
            "audio_raw": [float(i)],
            "imu_raw": {
                "accel_x": [0.0], "accel_y": [0.0], "accel_z": [9.8],
                "gyro_x": [0.0], "gyro_y": [0.0], "gyro_z": [0.0]
            }
        }
        buffer.add_data(payload)
        
    epochs = buffer.get_epochs()
    
    assert len(epochs) == 2
    assert epochs[0]["user_id"] == "user1"
    assert len(epochs[0]["hrv_raw"]) == 30
    assert epochs[0]["hrv_raw"][0] == 0.0
    assert epochs[0]["hrv_raw"][-1] == 29.0
    
    assert len(epochs[1]["hrv_raw"]) == 30
    assert epochs[1]["hrv_raw"][0] == 15.0
    assert epochs[1]["hrv_raw"][-1] == 44.0
    
    # Should retain 16 items in the buffer (30 to 45)
    assert len(buffer.data_stream) == 16

"""
Validator for incoming raw sensor data.
"""
from typing import Dict, Any

def validate_payload(payload: Dict[str, Any]) -> bool:
    """
    Validates the incoming sensor payload schema.
    
    Args:
        payload (Dict[str, Any]): Raw sensor data payload.
        
    Returns:
        bool: True if valid, False otherwise.
        
    Raises:
        ValueError: If essential fields are missing or invalid.
    """
    required_keys = ["timestamp", "user_id", "hrv_raw", "audio_raw", "imu_raw"]
    for key in required_keys:
        if key not in payload:
            raise ValueError(f"Missing required field: {key}")
            
    # Validate IMU structure
    imu = payload["imu_raw"]
    if not isinstance(imu, dict):
        raise ValueError("imu_raw must be a dictionary")
        
    imu_keys = ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"]
    for key in imu_keys:
        if key not in imu:
            raise ValueError(f"Missing imu_raw field: {key}")
            
    return True

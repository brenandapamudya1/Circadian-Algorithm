"""
IMU preprocessing module.
Extracts activity metrics from accelerometer and gyroscope data.
"""
from typing import Dict, List, Any
import numpy as np

def extract_imu_features(imu_raw: Dict[str, List[float]]) -> Dict[str, Any]:
    """
    Extracts dwell_minutes, posture_transitions, and activity_level.
    """
    if not imu_raw or "accel_x" not in imu_raw or not imu_raw["accel_x"]:
        return {"dwell_minutes": 0.0, "posture_transitions": 0, "activity_level": "low"}
        
    ax = np.array(imu_raw.get("accel_x", []))
    ay = np.array(imu_raw.get("accel_y", []))
    az = np.array(imu_raw.get("accel_z", []))
    
    min_len = min(len(ax), len(ay), len(az))
    if min_len == 0:
         return {"dwell_minutes": 0.0, "posture_transitions": 0, "activity_level": "low"}
         
    # Calculate magnitude of acceleration vector
    magnitude = np.sqrt(ax[:min_len]**2 + ay[:min_len]**2 + az[:min_len]**2)
    var = float(np.var(magnitude))
    
    # Simple heuristic to determine activity level
    if var > 5.0:
        activity = "high"
        transitions = int(var // 2)
        dwell = 0.0
    elif var > 1.0:
        activity = "moderate"
        transitions = int(var // 4)
        dwell = 0.2  # 0.2 minutes of inactivity out of a 30s (0.5 min) epoch
    else:
        activity = "low"
        transitions = 0
        dwell = 0.5  # fully inactive for the 30s epoch
        
    return {
        "dwell_minutes": dwell,
        "posture_transitions": transitions,
        "activity_level": activity
    }

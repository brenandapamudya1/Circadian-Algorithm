"""
Feature vector builder.
Assembles the final output payload for the downstream mood classifier.
"""
from typing import Dict, Any

PIPELINE_VERSION = "1.0.0"

def build_feature_vector(epoch: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transforms the fully processed and gated epoch into the final feature vector.
    """
    hrv_norm = epoch.get("hrv_normalized", {})
    vocal_norm = epoch.get("vocal_normalized", {})
    imu_norm = epoch.get("imu_normalized", {})
    
    hrv = {
        "rmssd": hrv_norm.get("rmssd", {}).get("value", 0.0),
        "sdnn": hrv_norm.get("sdnn", {}).get("value", 0.0),
        "zscore": float(epoch.get("hrv_zscore", 0.0))
    }
    
    vocal = {
        "f0": vocal_norm.get("f0_mean", {}).get("value", 0.0),
        "speech_rate": vocal_norm.get("speech_rate", {}).get("value", 0.0),
        "zscore": float(epoch.get("vocal_zscore", 0.0))
    }
    
    imu = {
        "dwell_min": imu_norm.get("dwell_minutes", {}).get("value", 0.0),
        "transitions": int(imu_norm.get("posture_transitions", {}).get("value", 0)),
        "zscore": float(epoch.get("imu_zscore", 0.0))
    }
    
    return {
        "epoch_id": epoch.get("epoch_id", ""),
        "timestamp": epoch.get("timestamp", ""),
        "user_id": epoch.get("user_id", ""),
        "window": epoch.get("window", "UNKNOWN"),
        "hrv": hrv,
        "vocal": vocal,
        "imu": imu,
        "circadian_valid": epoch.get("gating_passed", True),
        "suppressed_reason": epoch.get("suppressed_reason"),
        "pipeline_version": PIPELINE_VERSION
    }

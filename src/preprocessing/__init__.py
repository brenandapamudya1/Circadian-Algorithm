"""
Preprocessing module orchestrator.
"""
from typing import Dict, Any
from .hrv import extract_hrv_features
from .vocal import extract_vocal_features
from .imu import extract_imu_features

def process_epoch(epoch: Dict[str, Any]) -> Dict[str, Any]:
    """
    Processes a 30s epoch to extract all domain features.
    
    Args:
        epoch: Output from ingestion buffer
        
    Returns:
        Dict: Extracted features ready for circadian normalizer
    """
    hrv = extract_hrv_features(epoch.get("hrv_raw", []))
    vocal = extract_vocal_features(epoch.get("audio_raw", []))
    imu = extract_imu_features(epoch.get("imu_raw", {}))
    
    return {
        "epoch_id": epoch["epoch_id"],
        "timestamp": epoch["timestamp_start"],
        "user_id": epoch["user_id"],
        "hrv": hrv,
        "vocal": vocal,
        "imu": imu
    }

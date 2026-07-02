"""
Feature vector builder.
Assembles the final output payload for the downstream mood classifier.
Membaca pipeline_version dari config/gating_rules.yaml global.pipeline_version.
"""
from typing import Dict, Any
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_pipeline_version() -> str:
    """
    Membaca pipeline_version dari config/gating_rules.yaml global.pipeline_version.

    Returns:
        str: Versi pipeline. Default "1.0.0" jika config tidak ditemukan.
    """
    path = PROJECT_ROOT / "config" / "gating_rules.yaml"
    if path.exists():
        with open(path, "r") as f:
            data = yaml.safe_load(f)
            return str(data.get("global", {}).get("pipeline_version", "1.0.0"))
    return "1.0.0"


def build_feature_vector(epoch: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transforms the fully processed and gated epoch into the final feature vector.

    Args:
        epoch (Dict[str, Any]): Epoch yang sudah melalui anomaly detection dan gating.

    Returns:
        Dict[str, Any]: Final feature vector sesuai kontrak interface AGENT.md.
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
        "pipeline_version": _load_pipeline_version()
    }

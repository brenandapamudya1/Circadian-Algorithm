"""
Anomaly detector module.
Membaca zscore_threshold dari config/gating_rules.yaml agar tidak ada magic number.
"""
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_global_config() -> dict:
    """Loads the global section from gating_rules.yaml."""
    path = PROJECT_ROOT / "config" / "gating_rules.yaml"
    if path.exists():
        with open(path, "r") as f:
            data = yaml.safe_load(f)
            return data.get("global", {})
    return {}


def detect_anomalies(epoch: dict, threshold: float | None = None) -> dict:
    """
    Computes overall z-score per domain and flags them if they exceed the threshold.

    Args:
        epoch (dict): Normalized epoch output dari circadian/normalizer.
        threshold (float | None): Z-score threshold untuk flagging. Jika None,
            dibaca dari config/gating_rules.yaml global.zscore_threshold (default 2.0).

    Returns:
        dict: Berisi hrv_zscore, vocal_zscore, imu_zscore, dan anomaly_flags.
    """
    if threshold is None:
        threshold = _load_global_config().get("zscore_threshold", 2.0)
    def _get_max_zscore(normalized_domain: dict) -> float:
        zscores = []
        if not normalized_domain:
            return 0.0
            
        for k, v in normalized_domain.items():
            if isinstance(v, dict) and "zscore" in v:
                zscores.append(abs(v["zscore"]))
        return max(zscores) if zscores else 0.0

    hrv_z = _get_max_zscore(epoch.get("hrv_normalized", {}))
    vocal_z = _get_max_zscore(epoch.get("vocal_normalized", {}))
    imu_z = _get_max_zscore(epoch.get("imu_normalized", {}))
    
    return {
        "hrv_zscore": float(hrv_z),
        "vocal_zscore": float(vocal_z),
        "imu_zscore": float(imu_z),
        "anomaly_flags": {
            "hrv_anomaly": hrv_z > threshold,
            "vocal_anomaly": vocal_z > threshold,
            "imu_anomaly": imu_z > threshold,
        }
    }

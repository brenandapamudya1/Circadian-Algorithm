"""
Anomaly detector module.
"""
def detect_anomalies(epoch: dict, threshold: float = 2.0) -> dict:
    """
    Computes overall z-score per domain and flags them if they exceed the threshold.
    """
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

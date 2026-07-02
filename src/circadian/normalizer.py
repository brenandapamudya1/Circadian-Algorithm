from datetime import datetime, timezone
import yaml
from .window_classifier import get_biological_window, PROJECT_ROOT
from .baseline_manager import get_baseline

def get_calibration_info(timestamp_utc: str, profile: dict) -> tuple[int, bool]:
    """
    Calculates calibration days from the start date.
    """
    if timestamp_utc.endswith('Z'):
        timestamp_utc = timestamp_utc[:-1] + '+00:00'
    dt = datetime.fromisoformat(timestamp_utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
        
    cal_start_str = profile.get("calibration_start_date", dt.isoformat())
    if cal_start_str.endswith('Z'):
        cal_start_str = cal_start_str[:-1] + '+00:00'
    cal_start = datetime.fromisoformat(cal_start_str)
    if cal_start.tzinfo is None:
        cal_start = cal_start.replace(tzinfo=timezone.utc)
        
    days = (dt - cal_start).days
    # If negative, user might be testing in the past, cap to 0
    if days < 0:
        days = 0
        
    return days, days >= 7

def normalize_features(epoch: dict) -> dict:
    """
    Normalizes the epoch features against the personal baseline for that window.
    """
    profile = {}
    config_path = PROJECT_ROOT / "config" / "user_profile.yaml"
    if config_path.exists():
        with open(config_path, 'r') as f:
            profile = yaml.safe_load(f)
            if profile is None:
                profile = {}
            
    window = get_biological_window(epoch["timestamp"])
    baseline = get_baseline(epoch["user_id"], window)
    
    cal_day, is_calibrated = get_calibration_info(epoch["timestamp"], profile)
    
    def _normalize(domain_features, domain_baseline):
        norm = {}
        if not domain_features:
            return norm
            
        for k, v in domain_features.items():
            if isinstance(v, str):
                norm[k] = {"value": v}
                continue
                
            b_stats = domain_baseline.get(k, {})
            mean = b_stats.get("mean", float(v))
            std = b_stats.get("std", 1.0)
            if std == 0: 
                std = 1.0
            
            zscore = (v - mean) / std if is_calibrated else 0.0
            
            norm[k] = {
                "value": v,
                "baseline_mean": mean,
                "baseline_std": std,
                "zscore": float(zscore)
            }
        return norm
        
    output = dict(epoch)
    output.update({
        "window": window,
        "hrv_normalized": _normalize(epoch.get("hrv", {}), baseline.get("hrv", {})),
        "vocal_normalized": _normalize(epoch.get("vocal", {}), baseline.get("vocal", {})),
        "imu_normalized": _normalize(epoch.get("imu", {}), baseline.get("imu", {})),
        "calibration_day": cal_day,
        "is_calibrated": is_calibrated
    })
    
    return output

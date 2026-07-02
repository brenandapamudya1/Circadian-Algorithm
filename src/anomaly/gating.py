import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def load_gating_rules() -> dict:
    """
    Loads gating rules configuration from config/gating_rules.yaml.

    Returns:
        dict: Dict of rule ID ke konfigurasi rule. Dict kosong jika file tidak ada.
    """
    config_path = PROJECT_ROOT / "config" / "gating_rules.yaml"
    if config_path.exists():
        with open(config_path, 'r') as f:
            return yaml.safe_load(f).get("gating_rules", {})
    return {}

def _gr_01_sleep_window_imu(epoch: dict) -> bool:
    """
    GR-01: Suppress IMU anomali yang terjadi pada window NOCTURNAL (tidur normal).

    Args:
        epoch (dict): Epoch yang sudah memiliki anomaly_flags dan window.

    Returns:
        bool: False (suppress) jika IMU anomali saat NOCTURNAL, True jika lolos.
    """
    is_nocturnal = epoch.get("window") == "NOCTURNAL"
    imu_anomaly = epoch.get("anomaly_flags", {}).get("imu_anomaly", False)
    if is_nocturnal and imu_anomaly:
        return False
    return True

def _gr_02_exercise_pitch(epoch: dict) -> bool:
    """
    GR-02: Suppress vocal anomali F0 naik ketika IMU mendeteksi high activity (olahraga).

    Args:
        epoch (dict): Epoch dengan anomaly_flags, vocal_normalized, imu_normalized.

    Returns:
        bool: False (suppress) jika vocal anomali + F0 naik + activity high.
    """
    vocal_anomaly = epoch.get("anomaly_flags", {}).get("vocal_anomaly", False)
    
    f0_norm = epoch.get("vocal_normalized", {}).get("f0_mean", {})
    f0_val = f0_norm.get("value", 0.0)
    f0_mean = f0_norm.get("baseline_mean", 0.0)
    f0_increased = f0_val > f0_mean
    
    activity = epoch.get("imu_normalized", {}).get("activity_level", {}).get("value", "low")
    
    if vocal_anomaly and f0_increased and activity == "high":
        return False
    return True

def _gr_03_post_meal_hrv(epoch: dict) -> bool:
    """
    GR-03: Suppress HRV anomali (RMSSD turun) saat AFTERNOON atau EVENING window
    karena bisa disebabkan oleh digestion post-meal.

    Args:
        epoch (dict): Epoch dengan anomaly_flags, hrv_normalized, window.

    Returns:
        bool: False (suppress) jika HRV anomali + RMSSD turun di window post-meal.
    """
    hrv_anomaly = epoch.get("anomaly_flags", {}).get("hrv_anomaly", False)
    window = epoch.get("window")
    
    rmssd_norm = epoch.get("hrv_normalized", {}).get("rmssd", {})
    rmssd_val = rmssd_norm.get("value", 0.0)
    rmssd_mean = rmssd_norm.get("baseline_mean", 0.0)
    rmssd_dropped = rmssd_val < rmssd_mean
    
    if hrv_anomaly and rmssd_dropped and window in ["AFTERNOON", "EVENING"]:
        return False
    return True

def _gr_04_morning_activation(epoch: dict) -> bool:
    """
    GR-04: Suppress anomali pitch & HR naik alami di window MORNING
    (morning cortisol activation — bukan anomali patologis).

    Args:
        epoch (dict): Epoch dengan anomaly_flags, vocal_normalized, hrv_normalized, window.

    Returns:
        bool: False (suppress) jika pitch atau HR naik secara natural di MORNING.
    """
    vocal_anomaly = epoch.get("anomaly_flags", {}).get("vocal_anomaly", False)
    hrv_anomaly = epoch.get("anomaly_flags", {}).get("hrv_anomaly", False)
    window = epoch.get("window")
    
    if window == "MORNING":
        f0_val = epoch.get("vocal_normalized", {}).get("f0_mean", {}).get("value", 0.0)
        f0_mean = epoch.get("vocal_normalized", {}).get("f0_mean", {}).get("baseline_mean", 0.0)
        hr_val = epoch.get("hrv_normalized", {}).get("mean_hr", {}).get("value", 0.0)
        hr_mean = epoch.get("hrv_normalized", {}).get("mean_hr", {}).get("baseline_mean", 0.0)
        
        if (vocal_anomaly and f0_val > f0_mean) or (hrv_anomaly and hr_val > hr_mean):
            return False
            
    return True

GATING_FUNCTIONS = {
    "GR-01": _gr_01_sleep_window_imu,
    "GR-02": _gr_02_exercise_pitch,
    "GR-03": _gr_03_post_meal_hrv,
    "GR-04": _gr_04_morning_activation
}

def apply_gating_rules(epoch: dict) -> tuple[bool, str]:
    """
    Applies gating rules to an epoch.
    Returns (gating_passed: bool, suppressed_reason: Optional[str])
    """
    flags = epoch.get("anomaly_flags", {})
    has_anomaly = any(flags.values())
    
    if not has_anomaly:
        return True, None
        
    rules = load_gating_rules()
    
    is_calibrated = epoch.get("is_calibrated", True)
    if not is_calibrated:
        gr05 = rules.get("GR-05", {})
        if gr05.get("enabled", True):
            return True, None
            
    for rule_id, func in GATING_FUNCTIONS.items():
        rule_config = rules.get(rule_id, {})
        if rule_config.get("enabled", True):
            passed = func(epoch)
            if not passed:
                return False, rule_config.get("name", rule_id)
                
    return True, None

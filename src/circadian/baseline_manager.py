import json
from pathlib import Path
from typing import Dict, Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BASELINE_DIR = PROJECT_ROOT / "data" / "baselines"

def get_baseline(user_id: str, window: str) -> Dict[str, Any]:
    """
    Loads personal baseline for a specific user and biological window.
    """
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    file_path = BASELINE_DIR / f"{user_id}.json"
    
    if not file_path.exists():
        return {}
        
    with open(file_path, 'r') as f:
        try:
            data = json.load(f)
            return data.get(window, {})
        except json.JSONDecodeError:
            return {}

def update_baseline(user_id: str, window: str, new_features: Dict[str, Dict[str, float]]):
    """
    Updates the baseline using Exponential Moving Average (alpha = 0.1).
    Used primarily for daily updates, not per epoch.
    """
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    file_path = BASELINE_DIR / f"{user_id}.json"
    
    alpha = 0.1
    current_data = {}
    if file_path.exists():
        try:
            with open(file_path, 'r') as f:
                current_data = json.load(f)
        except json.JSONDecodeError:
            pass
            
    window_baseline = current_data.get(window, {})
    
    for category in ["hrv", "vocal", "imu"]:
        if category not in new_features:
            continue
            
        if category not in window_baseline:
            window_baseline[category] = {}
            
        for feat, val in new_features[category].items():
            if isinstance(val, str):
                continue
                
            if feat not in window_baseline[category]:
                window_baseline[category][feat] = {"mean": float(val), "std": 0.0}
            else:
                old_mean = window_baseline[category][feat].get("mean", float(val))
                old_var = window_baseline[category][feat].get("std", 0.0)**2
                
                new_mean = (alpha * float(val)) + ((1 - alpha) * old_mean)
                new_var = (alpha * (float(val) - old_mean)**2) + ((1 - alpha) * old_var)
                
                window_baseline[category][feat]["mean"] = new_mean
                window_baseline[category][feat]["std"] = float(new_var**0.5)

    current_data[window] = window_baseline
    
    with open(file_path, 'w') as f:
        json.dump(current_data, f, indent=2)

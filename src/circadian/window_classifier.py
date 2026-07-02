import yaml
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def load_config(file_name: str) -> dict:
    path = PROJECT_ROOT / "config" / file_name
    if path.exists():
        with open(path, 'r') as f:
            return yaml.safe_load(f)
    return {}

def get_biological_window(timestamp_utc: str) -> str:
    """
    Maps UTC timestamp to user's local biological window based on configuration.
    """
    windows = load_config("circadian_windows.yaml").get('windows', {})
    profile = load_config("user_profile.yaml")
    
    if timestamp_utc.endswith('Z'):
        timestamp_utc = timestamp_utc[:-1] + '+00:00'
    dt_utc = datetime.fromisoformat(timestamp_utc)
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
        
    tz_str = profile.get("timezone", "UTC")
    try:
        dt_local = dt_utc.astimezone(ZoneInfo(tz_str))
    except Exception:
        dt_local = dt_utc.astimezone(timezone.utc)
        
    local_time = dt_local.time()
    
    for window_name, window_info in windows.items():
        try:
            start_time = datetime.strptime(window_info["start"], "%H:%M:%S").time()
            end_time = datetime.strptime(window_info["end"], "%H:%M:%S").time()
        except ValueError:
            continue
            
        if start_time <= local_time <= end_time:
            return window_name
            
    return "UNKNOWN"

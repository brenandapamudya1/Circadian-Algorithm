import yaml
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def load_config(file_name: str) -> dict:
    """
    Loads a YAML configuration file from the config/ directory.

    Args:
        file_name (str): Nama file YAML (misal "circadian_windows.yaml").

    Returns:
        dict: Isi YAML sebagai dict Python. Dict kosong jika file tidak ada.
    """
    path = PROJECT_ROOT / "config" / file_name
    if path.exists():
        with open(path, 'r') as f:
            return yaml.safe_load(f)
    return {}

def get_biological_window(timestamp_utc: str) -> str:
    """
    Maps UTC timestamp to user's local biological window based on configuration.

    Args:
        timestamp_utc (str): Timestamp ISO 8601 dalam UTC
            (misal "2026-07-01T03:00:00Z" atau "2026-07-01T03:00:00+00:00").

    Returns:
        str: Nama biological window ("MORNING", "AFTERNOON", "EVENING",
            "PRE-SLEEP", "NOCTURNAL", atau "UNKNOWN" jika tidak ada yang cocok).

    Raises:
        Exception: Ditangkap secara internal jika timezone string tidak valid;
            fallback ke UTC.
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

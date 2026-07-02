"""
Parser for incoming raw sensor data.
"""
from typing import Dict, Any
from datetime import datetime, timezone

def parse_payload(raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses and standardizes the incoming payload.
    Converts timestamp to standard UTC string.
    
    Args:
        raw_payload (Dict[str, Any]): Validated raw sensor payload.
        
    Returns:
        Dict[str, Any]: Parsed payload.
    """
    parsed = dict(raw_payload)
    
    ts_str = parsed["timestamp"]
    if ts_str.endswith('Z'):
        ts_str = ts_str[:-1] + '+00:00'
        
    dt = datetime.fromisoformat(ts_str)
    
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    else:
        dt = dt.replace(tzinfo=timezone.utc)
    
    parsed["timestamp"] = dt.isoformat(timespec='milliseconds')
    
    return parsed

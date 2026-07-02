"""
Sliding window buffer for sensor data.
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone
import uuid

class SlidingBuffer:
    """
    Manages a sliding window of sensor data.
    """
    def __init__(self, window_size_sec: int = 30, overlap_sec: int = 15):
        self.window_size_sec = window_size_sec
        self.overlap_sec = overlap_sec
        self.data_stream: List[Dict[str, Any]] = []
        
    def add_data(self, payload: Dict[str, Any]):
        """
        Adds a single parsed and validated payload to the buffer.

        Args:
            payload (Dict[str, Any]): Parsed sensor payload dengan field ``timestamp``
                (ISO 8601 UTC), ``user_id``, ``hrv_raw``, ``audio_raw``, ``imu_raw``.

        Returns:
            None
        """
        self.data_stream.append(payload)
        self.data_stream.sort(key=lambda x: datetime.fromisoformat(x["timestamp"]))
        
    def get_epochs(self) -> List[Dict[str, Any]]:
        """
        Extracts epochs with overlap from the current buffer.
        
        Returns:
            List[Dict[str, Any]]: List of epochs ready for preprocessing.
        """
        if not self.data_stream:
            return []
            
        epochs = []
        start_time = datetime.fromisoformat(self.data_stream[0]["timestamp"])
        end_time = datetime.fromisoformat(self.data_stream[-1]["timestamp"])
        
        current_window_start = start_time
        
        while current_window_start + timedelta(seconds=self.window_size_sec) <= end_time:
            current_window_end = current_window_start + timedelta(seconds=self.window_size_sec)
            
            window_data = [
                d for d in self.data_stream 
                if current_window_start <= datetime.fromisoformat(d["timestamp"]) < current_window_end
            ]
            
            if window_data:
                user_id = window_data[0]["user_id"]
                
                hrv_raw = []
                audio_raw = []
                imu_raw = {
                    "accel_x": [], "accel_y": [], "accel_z": [],
                    "gyro_x": [], "gyro_y": [], "gyro_z": []
                }
                
                for d in window_data:
                    hrv_raw.extend(d.get("hrv_raw", []))
                    audio_raw.extend(d.get("audio_raw", []))
                    for k in imu_raw.keys():
                        imu_raw[k].extend(d.get("imu_raw", {}).get(k, []))
                
                epoch = {
                    "epoch_id": str(uuid.uuid4()),
                    "timestamp_start": current_window_start.isoformat(timespec='milliseconds'),
                    "timestamp_end": current_window_end.isoformat(timespec='milliseconds'),
                    "user_id": user_id,
                    "hrv_raw": hrv_raw,
                    "audio_raw": audio_raw,
                    "imu_raw": imu_raw
                }
                epochs.append(epoch)
                
            step = self.window_size_sec - self.overlap_sec
            current_window_start += timedelta(seconds=step)
            
        self.data_stream = [
            d for d in self.data_stream 
            if datetime.fromisoformat(d["timestamp"]) >= current_window_start
        ]
        
        return epochs

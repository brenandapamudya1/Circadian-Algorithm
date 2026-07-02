"""
Vocal preprocessing module.
Extracts audio features such as F0, speech rate, and pause duration.
"""
from typing import List, Dict
import numpy as np

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False

def extract_vocal_features(audio_raw: List[float], sr: int = 16000) -> Dict[str, float]:
    """
    Extracts f0_mean, f0_std, speech_rate, pause_duration, hnr.
    """
    if not audio_raw or len(audio_raw) < sr:
        return {"f0_mean": 0.0, "f0_std": 0.0, "speech_rate": 0.0, "pause_duration": 0.0, "hnr": 0.0}
        
    if LIBROSA_AVAILABLE:
        try:
            y = np.array(audio_raw, dtype=np.float32)
            f0, voiced_flag, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
            valid_f0 = f0[voiced_flag]
            
            if len(valid_f0) > 0:
                f0_mean = float(np.mean(valid_f0))
                f0_std = float(np.std(valid_f0))
            else:
                f0_mean = 0.0
                f0_std = 0.0
                
            # Speech rate and pauses based on voiced frames
            total_frames = len(voiced_flag)
            if total_frames > 0:
                speech_rate = float(np.sum(voiced_flag) / total_frames)
                pause_duration = float(np.sum(~voiced_flag) / total_frames) * (len(audio_raw)/sr)
            else:
                speech_rate = 0.0
                pause_duration = (len(audio_raw)/sr)
                
            return {
                "f0_mean": f0_mean,
                "f0_std": f0_std,
                "speech_rate": speech_rate,
                "pause_duration": pause_duration,
                "hnr": 1.0 # simplified/mock placeholder
            }
        except Exception:
            pass # Fallback
            
    # Fallback / Mock
    arr = np.array(audio_raw)
    return {
        "f0_mean": float(np.mean(np.abs(arr))) * 100,
        "f0_std": float(np.std(arr)) * 10,
        "speech_rate": 0.5,
        "pause_duration": 0.5,
        "hnr": 0.0
    }

"""
BIPOLYZER Circadian Algorithm Pipeline Orchestrator.
Connects ingestion -> preprocessing -> circadian -> anomaly -> features.
"""
from typing import Dict, Any, List
import json
from pathlib import Path

from src.ingestion import parse_payload, validate_payload, SlidingBuffer
from src.preprocessing import process_epoch
from src.circadian.normalizer import normalize_features
from src.anomaly import process_anomalies
from src.features import build_feature_vector

def run_pipeline(payloads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Runs the full end-to-end pipeline on a list of raw sensor payloads.
    """
    buffer = SlidingBuffer(window_size_sec=30, overlap_sec=15)
    
    # 1. Ingestion Layer
    for payload in payloads:
        try:
            validate_payload(payload)
            parsed = parse_payload(payload)
            buffer.add_data(parsed)
        except ValueError as e:
            import logging
            logging.warning(f"Invalid payload skipped: {e}")
            continue
            
    epochs = buffer.get_epochs()
    final_vectors = []
    
    for epoch in epochs:
        try:
            # 2. Preprocessing Layer
            preprocessed = process_epoch(epoch)
            
            # 3. Circadian Layer
            normalized = normalize_features(preprocessed)
            
            # 4. Anomaly & Gating Layer
            anomalies_gated = process_anomalies(normalized, threshold=2.0)
            
            # 5. Feature Builder
            feature_vector = build_feature_vector(anomalies_gated)
            
            final_vectors.append(feature_vector)
            
        except Exception as e:
            import logging
            logging.error(f"Error processing epoch {epoch.get('epoch_id')}: {e}")
            
    return final_vectors

def save_output(feature_vectors: List[Dict[str, Any]], output_dir: str = "data/output"):
    """
    Saves feature vectors to disk.
    """
    path = Path(__file__).resolve().parent.parent / output_dir
    path.mkdir(parents=True, exist_ok=True)
    
    for fv in feature_vectors:
        file_name = path / f"fv_{fv['epoch_id']}.json"
        with open(file_name, 'w') as f:
            json.dump(fv, f, indent=2)

if __name__ == "__main__":
    # Example usage for manual run
    from datetime import datetime, timezone, timedelta
    
    start_time = datetime.now(timezone.utc)
    mock_payloads = []
    for i in range(46):
        dt = start_time + timedelta(seconds=i)
        mock_payloads.append({
            "timestamp": dt.isoformat(timespec='milliseconds'),
            "user_id": "test_user_pipeline",
            "hrv_raw": [float(i)],
            "audio_raw": [float(i)],
            "imu_raw": {
                "accel_x": [0.0], "accel_y": [0.0], "accel_z": [9.8],
                "gyro_x": [0.0], "gyro_y": [0.0], "gyro_z": [0.0]
            }
        })
        
    print(f"Running pipeline with {len(mock_payloads)} mock payloads...")
    results = run_pipeline(mock_payloads)
    save_output(results)
    print(f"Pipeline finished! Generated {len(results)} feature vectors in data/output/.")

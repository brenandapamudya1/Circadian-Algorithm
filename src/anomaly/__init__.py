from .detector import detect_anomalies
from .gating import apply_gating_rules

def process_anomalies(epoch: dict, threshold: float = 2.0) -> dict:
    """
    Detects anomalies and applies contextual gating.
    """
    detection_res = detect_anomalies(epoch, threshold)
    
    output = dict(epoch)
    output.update(detection_res)
    
    gating_passed, suppressed_reason = apply_gating_rules(output)
    
    output["gating_passed"] = gating_passed
    output["suppressed_reason"] = suppressed_reason
    
    return output

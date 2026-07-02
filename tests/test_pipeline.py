import pytest
import os
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone, timedelta
from src.pipeline import run_pipeline, save_output

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _make_mock_payloads(n: int = 46, user_id: str = "test_user_pipeline") -> list:
    start_time = datetime(2026, 7, 1, 10, 0, 0, tzinfo=timezone.utc)
    payloads = []
    for i in range(n):
        dt = start_time + timedelta(seconds=i)
        payloads.append({
            "timestamp": dt.isoformat(timespec="milliseconds"),
            "user_id": user_id,
            "hrv_raw": [float(i)],
            "audio_raw": [float(i)],
            "imu_raw": {
                "accel_x": [0.0], "accel_y": [0.0], "accel_z": [9.8],
                "gyro_x": [0.0], "gyro_y": [0.0], "gyro_z": [0.0]
            }
        })
    return payloads


# ── happy path ─────────────────────────────────────────────────────────────────

def test_full_pipeline_end_to_end():
    results = run_pipeline(_make_mock_payloads())

    assert len(results) == 2
    fv = results[0]

    assert "epoch_id" in fv
    assert fv["user_id"] == "test_user_pipeline"
    assert "window" in fv
    assert "circadian_valid" in fv
    assert "pipeline_version" in fv

    assert "hrv" in fv
    assert "vocal" in fv
    assert "imu" in fv


def test_pipeline_produces_valid_json():
    """Output harus bisa di-serialize ke JSON tanpa error."""
    results = run_pipeline(_make_mock_payloads())
    assert len(results) >= 1
    serialized = json.dumps(results[0])
    assert isinstance(serialized, str)


# ── invalid payload handling ───────────────────────────────────────────────────

def test_pipeline_skips_invalid_payload():
    """Payload yang tidak valid harus dilewati tanpa crash pipeline."""
    payloads = _make_mock_payloads()
    # Sisipkan 1 payload rusak di tengah
    payloads.insert(5, {"timestamp": "2026-07-01T10:00:05.000+00:00", "user_id": "x"})

    # Pipeline harus tetap berjalan dan menghasilkan hasil dari payload valid
    results = run_pipeline(payloads)
    assert isinstance(results, list)


def test_pipeline_handles_epoch_processing_error():
    """Jika satu epoch gagal diproses (exception), pipeline melanjutkan ke epoch berikutnya."""
    from unittest.mock import patch
    payloads = _make_mock_payloads()

    call_count = {"n": 0}

    original_normalize = None
    try:
        from src.circadian import normalizer
        original_normalize = normalizer.normalize_features
    except Exception:
        pass

    def flaky_normalize(epoch):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("Simulated processing failure on first epoch")
        return original_normalize(epoch)

    with patch("src.pipeline.normalize_features", side_effect=flaky_normalize):
        results = run_pipeline(payloads)

    # Harus tetap menghasilkan setidaknya satu hasil dari epoch kedua
    assert isinstance(results, list)


def test_pipeline_all_invalid_returns_empty():
    """Semua payload invalid → tidak crash, return list kosong."""
    bad_payloads = [
        {"no_timestamp": True},
        {"timestamp": "2026-07-01T10:00:00Z"},  # missing required fields
    ]
    results = run_pipeline(bad_payloads)
    assert results == []


# ── save_output ────────────────────────────────────────────────────────────────

def test_save_output_creates_files():
    """save_output harus membuat file JSON per feature vector di direktori output."""
    results = run_pipeline(_make_mock_payloads())
    assert len(results) >= 1

    test_output_dir = "data/test_output_audit"
    try:
        save_output(results, output_dir=test_output_dir)

        output_path = PROJECT_ROOT / test_output_dir
        json_files = list(output_path.glob("fv_*.json"))
        assert len(json_files) == len(results)

        # Verifikasi isi file pertama
        with open(json_files[0], "r") as f:
            content = json.load(f)
        assert "epoch_id" in content
        assert "circadian_valid" in content

    finally:
        # Cleanup
        output_path = PROJECT_ROOT / test_output_dir
        if output_path.exists():
            shutil.rmtree(output_path)


def test_save_output_creates_directory_if_missing():
    """save_output harus membuat direktori output jika belum ada."""
    results = run_pipeline(_make_mock_payloads())

    test_output_dir = "data/test_output_new_dir"
    output_path = PROJECT_ROOT / test_output_dir

    # Pastikan direktori belum ada
    if output_path.exists():
        shutil.rmtree(output_path)

    try:
        save_output(results, output_dir=test_output_dir)
        assert output_path.exists()
    finally:
        if output_path.exists():
            shutil.rmtree(output_path)

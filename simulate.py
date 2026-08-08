"""
simulate.py  —  Simulasi End-to-End BIPOLYZER Circadian (Tanpa BLE)
--------------------------------------------------------------------
Mensimulasikan alur data lengkap di satu proses:

  [SensorSimulator]  →  asyncio.Queue  →  [DataProcessor]
   (seperti ESP32)       (seperti BLE)    (seperti ble_receiver.py)

Tidak butuh Bluetooth — cocok untuk testing pipeline di laptop.

Format data yang di-generate sama persis dengan ESPCode_new.c:
  {"uid": "user_001", "acc": [...], "gyr": [...], "bpm": 72,
   "rr": [...], "aRms": 0.043, "aZcr": 128}

Jalankan:
    python3 simulate.py

Tekan Ctrl+C untuk berhenti.
"""

import asyncio
import json
import math
import random
import datetime

# ── KONFIGURASI SIMULASI ──────────────────────────────────────
USER_ID        = "user_001"
EPOCH_SECONDS  = 5       # interval kirim data (detik) — ganti sesuai kebutuhan
TOTAL_EPOCHS   = None    # None = jalan terus, atau set angka misal 10
# ─────────────────────────────────────────────────────────────


# =============================================================
#  SENSOR SIMULATOR  (meniru ESPCode_new.c)
# =============================================================

class SensorSimulator:
    """Generate data sensor sintetis realistis per epoch."""

    def __init__(self):
        self._bpm_base = 72.0

    def next_epoch(self, duration_s: int = 5) -> dict:
        # ── Accel (m/s²) — gravitasi di Z, gerak ringan di X/Y
        ax = round(random.gauss(0.0,  0.15), 3)
        ay = round(random.gauss(0.0,  0.12), 3)
        az = round(random.gauss(9.81, 0.08), 3)

        # ── Gyro (°/s) — rotasi kecil
        gx = round(random.gauss(0.0, 0.5), 3)
        gy = round(random.gauss(0.0, 0.4), 3)
        gz = round(random.gauss(0.0, 0.3), 3)

        # ── BPM — variasi sirkadian ringan berdasarkan jam
        hour = datetime.datetime.utcnow().hour
        circadian_offset = 5 * math.sin(math.pi * (hour - 6) / 12)
        bpm = round(self._bpm_base + circadian_offset + random.gauss(0, 2))
        bpm = max(50, min(120, bpm))

        # ── RR Intervals (ms) — diturunkan dari BPM ± HRV
        rr_mean  = 60000.0 / bpm
        rr_count = round(bpm * duration_s / 60)
        rr_list  = []
        for _ in range(rr_count):
            rr = round(random.gauss(rr_mean, 30))
            rr = max(300, min(1500, rr))
            rr_list.append(rr)

        # ── Audio RMS + ZCR
        a_rms = round(random.uniform(0.005, 0.08), 4)
        a_zcr = random.randint(40, 200)

        return {
            "uid":  USER_ID,
            "acc":  [ax, ay, az],
            "gyr":  [gx, gy, gz],
            "bpm":  bpm,
            "rr":   rr_list,
            "aRms": a_rms,
            "aZcr": a_zcr,
        }


# =============================================================
#  DATA PROCESSOR  (meniru ble_receiver.py)
# =============================================================

def inject_timestamp() -> str:
    return datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"


def normalize_to_pipeline(sensor: dict, ts: str) -> dict:
    """Konversi payload ESP32 → format kontrak pipeline AGENT.md."""
    acc = sensor.get("acc", [0.0, 0.0, 0.0])
    gyr = sensor.get("gyr", [0.0, 0.0, 0.0])
    rr  = sensor.get("rr",  [])
    return {
        "timestamp": ts,
        "user_id":   sensor.get("uid", USER_ID),
        "hrv_raw":   rr,
        "audio_raw": {
            "rms": sensor.get("aRms", 0.0),
            "zcr": sensor.get("aZcr", 0),
        },
        "imu_raw": {
            "accel_x": [acc[0]],
            "accel_y": [acc[1]],
            "accel_z": [acc[2]],
            "gyro_x":  [gyr[0]],
            "gyro_y":  [gyr[1]],
            "gyro_z":  [gyr[2]],
        },
    }


def process_epoch(raw_json: str, epoch_num: int):
    """Parse, inject timestamp, print, dan normalisasi ke pipeline format."""
    sensor = json.loads(raw_json)
    ts     = inject_timestamp()

    # ── Hitung statistik RR
    rr      = sensor.get("rr", [])
    rr_mean = round(sum(rr) / len(rr)) if rr else 0
    rr_sdnn = 0.0
    if len(rr) > 1:
        mean    = sum(rr) / len(rr)
        rr_sdnn = round((sum((x - mean) ** 2 for x in rr) / len(rr)) ** 0.5, 1)

    acc = sensor.get("acc", [0, 0, 0])
    gyr = sensor.get("gyr", [0, 0, 0])

    # ── Print sensor data
    print(f"\n{'═'*60}")
    print(f"  EPOCH #{epoch_num:03d}  |  {ts}")
    print(f"{'═'*60}")
    print(f"  uid        : {sensor.get('uid', '?')}")
    print(f"  ┌─ IMU (MPU6050) {'─'*38}")
    print(f"  │  Accel  X : {acc[0]:>+8.3f} m/s²")
    print(f"  │  Accel  Y : {acc[1]:>+8.3f} m/s²")
    print(f"  │  Accel  Z : {acc[2]:>+8.3f} m/s²")
    print(f"  │  Gyro   X : {gyr[0]:>+8.3f} °/s")
    print(f"  │  Gyro   Y : {gyr[1]:>+8.3f} °/s")
    print(f"  │  Gyro   Z : {gyr[2]:>+8.3f} °/s")
    print(f"  ├─ HRV (MAX30100) {'─'*37}")
    print(f"  │  BPM      : {sensor.get('bpm', '?'):>8} bpm")
    print(f"  │  RR count : {len(rr):>8} intervals dalam epoch")
    print(f"  │  RR mean  : {rr_mean:>8} ms")
    print(f"  │  RR SDNN  : {rr_sdnn:>8.1f} ms  ← proxy HRV variability")
    print(f"  │  RR raw   : {rr[:5]}{'...' if len(rr) > 5 else ''}")
    print(f"  ├─ Audio (INMP441) {'─'*36}")
    print(f"  │  RMS      : {sensor.get('aRms', '?'):>8.4f}  ← energy level")
    print(f"  │  ZCR      : {sensor.get('aZcr', '?'):>8}  ← pitch proxy")
    print(f"  └─ Pipeline Format (AGENT.md) {'─'*26}")

    pipeline = normalize_to_pipeline(sensor, ts)
    p_json   = json.dumps(pipeline, separators=(",", ":"))
    # Print pipeline JSON per baris agar mudah dibaca
    for k, v in pipeline.items():
        v_str = json.dumps(v, separators=(",", ":"))
        if len(v_str) > 50:
            v_str = v_str[:50] + "..."
        print(f"     {k:12s}: {v_str}")
    print(f"{'─'*60}")


# =============================================================
#  ASYNC RUNNER — Producer + Consumer via Queue
# =============================================================

async def producer(queue: asyncio.Queue, sim: SensorSimulator):
    """Generate data sensor dan masukkan ke queue setiap EPOCH_SECONDS."""
    epoch = 0
    while TOTAL_EPOCHS is None or epoch < TOTAL_EPOCHS:
        epoch += 1
        data = sim.next_epoch(EPOCH_SECONDS)
        raw  = json.dumps(data, separators=(",", ":"))
        print(f"\n[SENDER] Epoch #{epoch:03d} → {len(raw)} bytes | "
              f"BPM={data['bpm']} | RR={len(data['rr'])} intervals | "
              f"RMS={data['aRms']:.4f}")
        await queue.put((epoch, raw))
        await asyncio.sleep(EPOCH_SECONDS)

    await queue.put(None)  # sentinel untuk stop consumer


async def consumer(queue: asyncio.Queue):
    """Ambil data dari queue dan proses (parse, print, normalize)."""
    while True:
        item = await queue.get()
        if item is None:
            print("\n[RECEIVER] Semua epoch selesai diproses.")
            break
        epoch_num, raw_json = item
        process_epoch(raw_json, epoch_num)
        queue.task_done()


async def main():
    print("╔" + "═"*58 + "╗")
    print("║  BIPOLYZER Circadian — Simulasi End-to-End             ║")
    print("║  Sender  → Queue → Receiver (tanpa BLE)               ║")
    print(f"║  Epoch interval : {EPOCH_SECONDS}s  |  User: {USER_ID:<28}║")
    print("╚" + "═"*58 + "╝")
    print(f"\n  Tekan Ctrl+C untuk berhenti.\n")

    queue = asyncio.Queue(maxsize=5)
    sim   = SensorSimulator()

    prod = asyncio.create_task(producer(queue, sim))
    cons = asyncio.create_task(consumer(queue))

    try:
        await asyncio.gather(prod, cons)
    except asyncio.CancelledError:
        pass


# ── ENTRY POINT ───────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n[EXIT] Simulasi dihentikan.")

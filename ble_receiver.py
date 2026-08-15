"""
ble_receiver.py  —  Penerima Data Sensor Circadian via BLE
-----------------------------------------------------------
Menerima data dari ESP32 (atau ble_sender.py simulator).

Format JSON yang diterima dari jam3.ino (firmware aktif):
{
  "uid":  "user_001",
  "bat":  87,                 <- baterai %
  "acc":  [ax, ay, az],       <- m/s²
  "bpm":  72,
  "rr":   [832, 845, ...],    <- RR interval ms
  "aRms": 0.043
}
Catatan: jam3.ino TIDAK mengirim "gyr" dan "aZcr" (opsional).

Varian kompatibel ESPCode_new.c (firmware lama) juga tetap ditangani:
{
  "uid":  "user_001",
  "acc":  [ax, ay, az],
  "gyr":  [gx, gy, gz],       <- °/s (opsional)
  "bpm":  72,
  "rr":   [...],
  "aRms": 0.043,
  "aZcr": 128                 <- opsional
}

Epoch dikirim setiap ~30 detik oleh firmware ESP32.

Setelah diterima:
  1. Inject timestamp dari jam sistem (karena ESP32 tidak kirim ts)
  2. Print data sensor dengan format rapi
  3. Normalisasi ke format kontrak pipeline AGENT.md

Kebutuhan:
    pip install bleak
"""

import asyncio
import json
import datetime
from typing import Optional
from bleak import BleakClient, BleakScanner

# ── KONFIGURASI ────────────────────────────────────────────────
DEVICE_NAME         = "Circadian"
SERVICE_UUID        = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
DEFAULT_USER_ID     = "user_001"
# ──────────────────────────────────────────────────────────────


def inject_timestamp() -> str:
    """Buat timestamp UTC ISO 8601 dari jam sistem penerima."""
    return datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"


def normalize_to_pipeline(sensor: dict, ts: str) -> dict:
    """
    Konversi payload ESP32 → format kontrak pipeline AGENT.md.

    Input  (dari ESP32):
        uid, acc[3], bpm, rr[], aRms
        (opsional: bat, gyr[3], aZcr — jam3.ino tidak mengirim gyr/aZcr)

    Output (kontrak AGENT.md ingestion layer):
        timestamp, user_id, hrv_raw, audio_raw, imu_raw
    """
    acc = sensor.get("acc", [0.0, 0.0, 0.0])
    gyr = sensor.get("gyr", [0.0, 0.0, 0.0])
    rr  = sensor.get("rr",  [])

    return {
        "timestamp": ts,
        "user_id":   sensor.get("uid", DEFAULT_USER_ID),
        # HRV: RR interval array (ms) sebagai proxy hrv_raw
        # Pipeline preprocessing/hrv.py akan hitung RMSSD, SDNN dari ini
        "hrv_raw":   rr,
        # Audio: dict fitur proxy (RMS + ZCR dihitung di ESP32)
        "audio_raw": {
            "rms": sensor.get("aRms", 0.0),
            "zcr": sensor.get("aZcr", 0),
        },
        # IMU: sesuai kontrak AGENT.md (list per axis)
        "imu_raw": {
            "accel_x": [acc[0]] if len(acc) > 0 else [0.0],
            "accel_y": [acc[1]] if len(acc) > 1 else [0.0],
            "accel_z": [acc[2]] if len(acc) > 2 else [0.0],
            "gyro_x":  [gyr[0]] if len(gyr) > 0 else [0.0],
            "gyro_y":  [gyr[1]] if len(gyr) > 1 else [0.0],
            "gyro_z":  [gyr[2]] if len(gyr) > 2 else [0.0],
        },
    }


def parse_and_print(data: bytearray):
    """Parse payload JSON dari ESP32, inject timestamp, lalu print."""
    try:
        raw_str = data.decode("utf-8").strip()
        sensor  = json.loads(raw_str)

        # 1. Inject timestamp dari jam sistem penerima
        ts = inject_timestamp()

        # 2. Hitung RR stats jika ada
        rr = sensor.get("rr", [])
        rr_mean = round(sum(rr) / len(rr)) if rr else 0
        rr_sdnn = 0
        if len(rr) > 1:
            mean = sum(rr) / len(rr)
            rr_sdnn = round((sum((x - mean) ** 2 for x in rr) / len(rr)) ** 0.5, 1)

        acc = sensor.get("acc", [0, 0, 0])
        gyr = sensor.get("gyr", [0, 0, 0])

        # 3. Print data sensor
        payload_size = len(raw_str.encode("utf-8"))
        print(f"\n{'─'*58}")
        print(f"  [EPOCH] {ts}")
        print(f"{'─'*58}")
        print(f"  UID        : {sensor.get('uid', '?')}")
        print(f"  Battery    : {sensor.get('bat', 'N/A')} %")
        print(f"  Payload    : {payload_size} bytes")
        print(f"  ── IMU (MPU6050) ───────────────────────────────")
        print(f"  Accel X    : {acc[0]:>+8.3f} m/s²")
        print(f"  Accel Y    : {acc[1]:>+8.3f} m/s²")
        print(f"  Accel Z    : {acc[2]:>+8.3f} m/s²")
        if "gyr" in sensor:
            print(f"  Gyro  X    : {gyr[0]:>+8.3f} °/s")
            print(f"  Gyro  Y    : {gyr[1]:>+8.3f} °/s")
            print(f"  Gyro  Z    : {gyr[2]:>+8.3f} °/s")
        else:
            print(f"  Gyro       : N/A (tidak dikirim jam3.ino)")
        print(f"  ── HRV (MAX30100) ──────────────────────────────")
        print(f"  BPM        : {sensor.get('bpm', '?'):>8} bpm")
        print(f"  RR count   : {len(rr):>8} intervals")
        print(f"  RR mean    : {rr_mean:>8} ms")
        print(f"  RR SDNN    : {rr_sdnn:>8.1f} ms  (proxy variabilitas)")
        print(f"  RR raw     : {str(rr[:6])}{'...' if len(rr)>6 else ''}")
        print(f"  ── Audio (INMP441) ─────────────────────────────")
        print(f"  RMS energy : {sensor.get('aRms', '?'):>8.4f}")
        print(f"  Zero-Cross : {sensor.get('aZcr', 'N/A'):>8}")

        # 4. Normalisasi ke format pipeline
        pipeline_payload = normalize_to_pipeline(sensor, ts)
        pipeline_json    = json.dumps(pipeline_payload, indent=None,
                                      separators=(",", ":"))
        print(f"  ── Pipeline Format (AGENT.md kontrak) ──────────")
        print(f"  {pipeline_json[:120]}{'...' if len(pipeline_json)>120 else ''}")
        print(f"{'─'*58}")

    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"\n[WARN] Gagal parse: {e}")
        print(f"       Raw bytes: {data.hex()}")
    except (IndexError, TypeError) as e:
        print(f"\n[WARN] Data tidak lengkap: {e}")


def notification_handler(sender, data: bytearray):
    """Callback dipanggil setiap ada NOTIFY dari ESP32 / sender."""
    parse_and_print(data)


async def scan_and_connect():
    """Scan BLE, connect, dan subscribe NOTIFY."""

    print("=" * 58)
    print("  Circadian BLE Receiver  (jam3.ino format)")
    print("=" * 58)

    # ── STRATEGI 1: Cari by nama "Circadian" ──────────────────
    print(f"\n[SCAN] Mencari \"{DEVICE_NAME}\" by nama (10 detik)...")
    device = await BleakScanner.find_device_by_name(DEVICE_NAME, timeout=10.0)

    # ── STRATEGI 2: Cari by Service UUID ──────────────────────
    if device is None:
        print(f"[SCAN] Nama tidak ditemukan. Coba by Service UUID (10 detik)...")
        all_devs = await BleakScanner.discover(timeout=10.0, return_adv=True)
        for addr, (dev, adv) in all_devs.items():
            if SERVICE_UUID.lower() in [u.lower() for u in adv.service_uuids]:
                device = dev
                print(f"[SCAN] ✓ Ditemukan via UUID! Addr: {addr}")
                break

    # ── STRATEGI 3: Debug — print semua perangkat yang ada ────
    if device is None:
        print(f"\n[DEBUG] Tidak ditemukan. Semua BLE device dalam jangkauan:")
        all_devs = await BleakScanner.discover(timeout=8.0, return_adv=True)
        if not all_devs:
            print("        (tidak ada perangkat sama sekali)")
        for addr, (dev, adv) in all_devs.items():
            name = dev.name or adv.local_name or "(no name)"
            uuids = adv.service_uuids
            print(f"        [{addr}] {name}")
            if uuids:
                for u in uuids:
                    print(f"               UUID: {u}")
        print("\n[ERROR] Pastikan ble_sender.py berjalan sebagai sudo dan dalam jangkauan.")
        return

    # ── CONNECT & SUBSCRIBE ────────────────────────────────────
    print(f"\n[CONN] Menghubungkan ke {device.address}...")

    async with BleakClient(device) as client:
        if not client.is_connected:
            print("[ERROR] Gagal terhubung.")
            return

        print(f"[CONN] ✓ Terhubung ke {device.address}")
        print(f"[MTU]  ATT MTU negotiated: {client.mtu_size} bytes "
              f"(max payload/notify = {client.mtu_size - 3} bytes)")
        print(f"[BLE]  Subscribe NOTIFY → {CHARACTERISTIC_UUID}")
        print(f"\n[OK]   Menerima epoch setiap ~30 detik. Ctrl+C untuk berhenti.\n")

        await client.start_notify(CHARACTERISTIC_UUID, notification_handler)

        try:
            while client.is_connected:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        finally:
            await client.stop_notify(CHARACTERISTIC_UUID)
            print("\n[CONN] Koneksi ditutup.")


# ── ENTRY POINT ────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(scan_and_connect())
    except KeyboardInterrupt:
        print("\n[EXIT] Dihentikan oleh pengguna.")

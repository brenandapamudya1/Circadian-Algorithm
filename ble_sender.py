"""
ble_sender.py  —  Simulator ESP32 BLE (BIPOLYZER Circadian Sensor Node)
------------------------------------------------------------------------
Mensimulasikan perilaku ESPCode_new.c:
- Advertise BLE dengan SERVICE_UUID yang sama
- Generate data sensor sintetis realistis (Accel, Gyro, BPM, RR, Audio)
- Kirim via BLE NOTIFY ke receiver setiap EPOCH_SECONDS detik

Format JSON yang dikirim (sama persis dengan ESPCode_new.c):
{
  "uid":  "user_001",
  "acc":  [ax, ay, az],      <- m/s²
  "gyr":  [gx, gy, gz],      <- °/s
  "bpm":  72,
  "rr":   [832, 845, ...],   <- RR interval dalam ms
  "aRms": 0.043,
  "aZcr": 128
}

NOTE: Timestamp TIDAK ada di JSON ESP32.
      Di-inject oleh receiver (ble_receiver.py).

Kebutuhan:
    pip install bless
"""

import asyncio
import json
import math
import random
import logging
import datetime
from typing import Any, Dict

from bless import (
    BlessServer,
    BlessGATTCharacteristic,
    GATTCharacteristicProperties,
    GATTAttributePermissions,
)

# ── KONFIGURASI (harus sama persis dengan ESPCode_new.c) ──────
SERVICE_UUID        = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
DEVICE_NAME         = "Circadian"
USER_ID             = "user_001"

EPOCH_SECONDS       = 2   # 30s di ESP asli; 10s untuk simulasi lebih cepat
# ──────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.WARNING)  # suppress bless verbose logs


# ── GENERATOR DATA SENSOR SINTETIS ────────────────────────────

class SensorSimulator:
    """Mensimulasikan pembacaan sensor secara realistis per epoch."""

    def __init__(self):
        self._t        = 0.0       # waktu simulasi (detik)
        self._bpm_base = 72.0      # baseline BPM
        self._pos_z    = 1.0       # orientasi (1 = tegak)

    def next_epoch(self, duration_s: int = 10) -> Dict[str, Any]:
        """Generate satu epoch data sensor."""
        self._t += duration_s

        # ── ACCEL (m/s²) — simulasi gerakan ringan + gravitasi di Z ──
        ax = round(random.gauss(0.0,  0.15), 3)
        ay = round(random.gauss(0.0,  0.12), 3)
        az = round(random.gauss(9.81, 0.08), 3)   # gravitasi dominan Z

        # ── GYRO (°/s) — simulasi rotasi kecil saat duduk ─────────
        gx = round(random.gauss(0.0, 0.5), 3)
        gy = round(random.gauss(0.0, 0.4), 3)
        gz = round(random.gauss(0.0, 0.3), 3)

        # ── BPM — variasi sirkadian ringan ─────────────────────────
        hour = datetime.datetime.utcnow().hour
        # Pagi naik, siang stabil, malam turun
        circadian_offset = 5 * math.sin(math.pi * (hour - 6) / 12)
        bpm = round(self._bpm_base + circadian_offset + random.gauss(0, 2))
        bpm = max(50, min(120, bpm))

        # ── RR INTERVALS (ms) — diturunkan dari BPM ────────────────
        # RR mean = 60000 / BPM, tambah variabilitas HRV ±30ms
        rr_mean = 60000.0 / bpm
        rr_count = round(bpm * duration_s / 60)   # jumlah beat dalam epoch
        rr_list = []
        for _ in range(rr_count):
            rr = round(random.gauss(rr_mean, 30))
            rr = max(300, min(1500, rr))           # validasi fisiologis
            rr_list.append(rr)

        # ── AUDIO RMS + ZCR — ambient noise rendah ─────────────────
        # Skenario: pengguna diam/ngobrol santai
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


# ── BLE SERVER (GATT Peripheral) ──────────────────────────────

server: BlessServer = None
char_value: bytes   = b"Menunggu epoch pertama..."
simulator = SensorSimulator()


def read_request(characteristic: BlessGATTCharacteristic, **kwargs) -> bytearray:
    """Handler saat klien melakukan READ pada karakteristik."""
    return bytearray(char_value)


def write_request(characteristic: BlessGATTCharacteristic,
                  value: Any, **kwargs):
    """Handler saat klien melakukan WRITE (tidak dipakai, tapi wajib ada)."""
    pass


async def run_server():
    global server, char_value

    print("=" * 58)
    print("  Circadian BLE Sender  (ESP32 Simulator)")
    print(f"  Device Name : {DEVICE_NAME}")
    print(f"  Service UUID: {SERVICE_UUID}")
    print(f"  Epoch       : {EPOCH_SECONDS} detik")
    print("=" * 58)

    # Inisialisasi BlessServer
    server = BlessServer(name=DEVICE_NAME, loop=asyncio.get_event_loop())
    server.read_request_func  = read_request
    server.write_request_func = write_request

    # Tambahkan GATT service + characteristic
    await server.add_new_service(SERVICE_UUID)
    char_flags = (
        GATTCharacteristicProperties.read |
        GATTCharacteristicProperties.notify
    )
    permissions = GATTAttributePermissions.readable
    await server.add_new_characteristic(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        char_flags,
        bytearray(char_value),
        permissions,
    )

    # Mulai advertise
    await server.start()
    print(f"\n[ADV]  Advertising aktif sebagai \"{DEVICE_NAME}\"")
    print(f"[ADV]  Jalankan ble_receiver.py di terminal lain untuk connect.\n")

    epoch_num = 0
    try:
        while True:
            await asyncio.sleep(EPOCH_SECONDS)
            epoch_num += 1

            # Generate data sensor simulasi
            payload_dict = simulator.next_epoch(EPOCH_SECONDS)
            payload_json = json.dumps(payload_dict, separators=(",", ":"))
            char_value   = payload_json.encode("utf-8")

            # Update nilai karakteristik dan kirim NOTIFY ke semua subscriber
            server.get_characteristic(CHARACTERISTIC_UUID).value = bytearray(char_value)
            server.update_value(SERVICE_UUID, CHARACTERISTIC_UUID)

            # Print ringkasan epoch ke terminal
            d = payload_dict
            rr = d["rr"]
            print(f"[EPOCH {epoch_num:03d}] ─────────────────────────────────────────")
            print(f"  Timestamp (injected) : {datetime.datetime.utcnow().isoformat()}Z")
            print(f"  uid   : {d['uid']}")
            print(f"  acc   : X={d['acc'][0]:+.3f}  Y={d['acc'][1]:+.3f}  Z={d['acc'][2]:+.3f} m/s²")
            print(f"  gyr   : X={d['gyr'][0]:+.3f}  Y={d['gyr'][1]:+.3f}  Z={d['gyr'][2]:+.3f} °/s")
            print(f"  bpm   : {d['bpm']} bpm")
            print(f"  rr    : {len(rr)} intervals | mean={round(sum(rr)/len(rr)) if rr else 0} ms")
            print(f"  aRms  : {d['aRms']:.4f}")
            print(f"  aZcr  : {d['aZcr']}")
            print(f"  JSON  : {payload_json[:80]}{'...' if len(payload_json)>80 else ''}")
            print(f"  Size  : {len(char_value)} bytes\n")

    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        await server.stop()
        print("\n[EXIT] BLE Server dihentikan.")


# ── ENTRY POINT ───────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\n[EXIT] Dihentikan oleh pengguna.")

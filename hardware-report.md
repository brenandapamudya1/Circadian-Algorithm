Hardware Report - Circadian Sensor Mapping
==========================================

Firmware: jam3.ino
Test Date: 14 August 2026
Test Method: ble_receiver.py (BLE GATT notification)


1. BLE CONNECTION
-----------------
Status: OK
Device Name: Circadian
Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
Characteristic UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8
Payload Interval: 30 seconds
Payload Size: ~80 bytes (with no sensor data)
TX Power: ESP_PWR_LVL_N21 (-21 dBm)

Finding: BLE connection and notification delivery are confirmed working.
Data is received by ble_receiver.py every 30 seconds without issues.


2. BLE PAYLOAD FORMAT (jam3.ino line 564-568)
----------------------------------------------
JSON structure sent via BLE NOTIFY:
{
  "uid": "user_001",
  "bat": <int>,        // battery percentage 0-100
  "acc": [x, y, z],    // accelerometer in m/s2
  "bpm": <float>,      // heart rate in bpm
  "rr": [<ms>, ...],   // RR intervals in milliseconds
  "aRms": <float>      // audio RMS energy
}

Note: jam3.ino does NOT send "gyr" (gyroscope) or "aZcr" (audio zero crossing rate).
These fields exist in ESPCode_new.c but not in jam3.ino.


3. SENSOR-BY-SENSOR MAPPING
-----------------------------

3a. BATTERY (bat)
    Source: getBatteryData() - jam3.ino line 227-242
    ADC Pin: BATT_PIN (GPIO 4)
    Voltage Divider: BATT_DIVIDER_RATIO = 2.0
    Samples: 8 per read
    Status: WORKING (71% to 73% observed in test)
    Mapping: analogReadMilliVolts(BATT_PIN) -> voltage -> percentage

3b. ACCELEROMETER (acc)
    Source: readMPU() - jam3.ino line 319-341
    I2C Address: MPU_ADDR (0x68)
    I2C Bus: Wire (SDA=GPIO 8, SCL=GPIO 9, 400kHz)
    Interrupt Pin: MPU_INT_PIN (GPIO 10) - triggers mpuISR() on RISING
    Scale Factor: 16384 LSB/g, multiplied by 9.81 for m/s2
    Init: configureMPU_Normal() - jam3.ino line 343-349
    Data Flow: mpuISR() sets mpuDataReady -> loop reads via readMPU() -> stores in lastAccX/Y/Z
    Status: ALL ZEROS (0.000, 0.000, 0.000)
    Possible Causes:
      - MPU6050 not detected on I2C (SDA/SCL wiring issue)
      - MPU_INT_PIN (GPIO 10) not connected or wrong pin
      - configureMPU_Normal() register writes failing silently (no error check at line 343-349)
      - I2C bus conflict with MAX30100 (both on same bus: SDA=8, SCL=9)
    Mapping: Wire.requestFrom(0x68, 14) -> rawAccX/Y/Z -> /16384 * 9.81 -> lastAccX/Y/Z -> JSON acc[3]

3c. HEART RATE (bpm)
    Source: PulseOximeter (MAX30100 library) - jam3.ino line 548
    I2C Address: MAX30100_ADDR (0x57)
    I2C Bus: Wire (SDA=GPIO 8, SCL=GPIO 9)
    Init: initMax30100() - jam3.ino line 146-155
    Data Flow: maxConnected must be true -> pox.update() -> pox.getHeartRate()
    Status: ZERO (bpm = 0)
    Possible Causes:
      - MAX30100 not detected during initMax30100() (pox.begin() returns false)
      - MAX30100 not connected on I2C bus
      - maxConnected flag remains false (line 95), disabling pox.update() at line 472
      - Serial monitor should show "[WARN] ERROR: MAX30100 tidak terdeteksi!"
    Mapping: pox.getHeartRate() -> currentBPM -> JSON "bpm"

3d. RR INTERVALS (rr)
    Source: onBeatDetected() callback - jam3.ino line 126-135
    Buffer: rrBuffer[MAX_RR=60] - stores RR intervals in ms
    Valid Range: 300ms to 1500ms (filters out invalid beats)
    Status: EMPTY (rr = [])
    Possible Causes:
      - Same as bpm: maxConnected = false means pox.update() never runs
      - No onBeatDetected callback registered if initMax30100 failed
      - All RR values outside 300-1500ms range (unlikely if BPM valid)
    Mapping: rrBuffer[] -> rrCount -> JSON "rr":[...]

3e. AUDIO RMS (aRms)
    Source: I2S read in loop() - jam3.ino line 491-508
    Mic: INMP441 via I2S
    I2S Pins: SCK=GPIO 16, WS=GPIO 17, SD=GPIO 18
    Mic Power: MIC_VCC_PIN (GPIO 5), controlled by micPowerState (button toggle)
    Sample Rate: 16000 Hz
    Power Control: Button BTN_PIN (GPIO 7) toggles micPowerState
    micPowerState default: true (ON) - line 86
    Status: ZERO (0.0000)
    Possible Causes:
      - INMP441 not wired correctly (SCK/WS/SD pin mismatch)
      - MIC_VCC_PIN (GPIO 5) not providing power to mic
      - I2S driver install failure (i2s_install() at line 205)
      - micPowerState accidentally set to false by button press
    Mapping: i2s_read() -> frameRms -> audioRmsAccum -> / audioFrameCount -> JSON "aRms"


4. I2C BUS LAYOUT (jam3.ino)
------------------------------
jam3.ino uses ONE shared I2C bus for all sensors:

  Wire.begin(SDA=GPIO 8, SCL=GPIO 9) - line 366
  Clock: 400kHz - line 367
  Timeout: 50ms - line 368

  Device         I2C Address    Bus
  --------       -----------    ---
  MAX30100       0x57           Wire (shared)
  MPU6050        0x68           Wire (shared)
  SSD1306 OLED   0x3C           Wire (shared, via U8G2)

NOTE: ESPCode_new.c uses TWO separate I2C buses:
  - Bus 0 (SDA=8, SCL=9): MAX30100
  - Bus 1 (SDA=10, SCL=11): MPU6050
jam3.ino consolidated to one bus. If there are electrical issues (bus contention,
pull-up conflicts), this could cause sensor detection failures.


5. WIRING SUMMARY (jam3.ino pin map)
--------------------------------------
  GPIO 4  - BATT_PIN (battery voltage ADC)
  GPIO 5  - MIC_VCC_PIN (INMP441 power control)
  GPIO 7  - BTN_PIN (button for mic toggle, INPUT_PULLUP)
  GPIO 8  - I2C SDA (shared: MAX30100, MPU6050, OLED)
  GPIO 9  - I2C SCL (shared: MAX30100, MPU6050, OLED)
  GPIO 10 - MPU_INT_PIN (MPU6050 interrupt)
  GPIO 14 - TRANSISTOR_PIN (power transistor control)
  GPIO 16 - I2S SCK (INMP441)
  GPIO 17 - I2S WS (INMP441)
  GPIO 18 - I2S SD (INMP441)


6. DIAGNOSIS SUMMARY
---------------------
Confirmed Working:
  - BLE connection and notification delivery
  - Battery voltage reading (ADC)
  - Payload JSON formatting and transmission

Not Working (all zero):
  - Accelerometer (MPU6050) - I2C or interrupt wiring issue
  - Heart rate (MAX30100) - I2C detection failure
  - Audio (INMP441) - I2S or power wiring issue

Root Cause Hypothesis:
  The most likely cause is a hardware wiring issue on the physical board,
  since three independent sensors all fail simultaneously while the shared
  I2C bus and battery ADC work. Possible explanations:
  - Loose solder joints on I2C SDA/SCL lines
  - Missing pull-up resistors on shared I2C bus
  - Power supply issue to sensor modules (despite battery working)
  - I2C bus contention from three devices on one bus

Recommended Actions:
  1. Check serial monitor output at boot for MAX30100 detection status
  2. Verify I2C SDA (GPIO 8) and SCL (GPIO 9) with oscilloscope or logic analyzer
  3. Check if MPU6050 INT pin is correctly wired to GPIO 10
  4. Verify INMP441 power (GPIO 5 HIGH) and I2S connections
  5. Consider separating MPU6050 back to its own I2C bus (as in ESPCode_new.c)

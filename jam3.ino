#include <Wire.h>
#include "MAX30100_PulseOximeter.h"
#include <driver/i2s.h>
#include <math.h>                  
#include "esp_timer.h"       

// === BLE ===
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "esp_bt.h"  

// === OLED U8G2 ===
#include <U8g2lib.h>

#define USER_ID     "user_001" 

// --- PIN CONFIG ESP32-S3 ---
#define I2C_SDA 8
#define I2C_SCL 9
#define MPU_ADDR 0x68
#define MAX30100_ADDR 0x57   

#define I2S_WS   17
#define I2S_SCK  16
#define I2S_SD   18
#define I2S_PORT I2S_NUM_0

#define MIC_VCC_PIN     5   
#define BATT_PIN        4   
#define BTN_PIN         7   
#define TRANSISTOR_PIN  14  
#define MPU_INT_PIN     10  

// --- BLE CONFIG ---
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// --- BATERAI CONFIG ---
#define BATT_DIVIDER_RATIO 2.0f   
#define BATT_ADC_SAMPLES   8      
#define BATT_TRIGGER_MIN_CONSECUTIVE 2   

// --- TIMING CONFIG ---
const unsigned long LIVE_INTERVAL       = 3000UL;  
const unsigned long OLED_INTERVAL       = 10000UL; 
const unsigned long EPOCH_MS            = 30000UL; 
const unsigned long TRANSISTOR_INTERVAL = 2000UL;  
const unsigned long WATCHDOG_INTERVAL   = 5000UL;
const unsigned long CONNECT_NOTIF_DURATION = 5000UL;   

// --- INSTANSIASI OBJEK ---
PulseOximeter pox;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

// === VARIABEL BLE ===
BLECharacteristic *pCharacteristic = nullptr;
bool deviceConnected = false;
bool bleInitialized  = false;   
bool prevDeviceConnected = false;   
bool needsRestartAdvertising = false;

// --- BUFFER & AKUMULATOR ---
#define MAX_RR  60                
uint16_t rrBuffer[MAX_RR];
int      rrCount      = 0;
unsigned long lastBeatMs = 0;

float audioRmsAccum  = 0.0f;
long  audioZcrAccum  = 0;
int   audioFrameCount = 0;

// --- STATE & TIMING TRACKERS ---
unsigned long epochStart = 0;
unsigned long lastOledMs = 0;
unsigned long lastSerialMs = 0;
unsigned long lastTransistorMs = 0;
unsigned long lastWatchdogMs = 0;
unsigned long connectNotifUntil = 0;   

bool transistorState = false;
int  battFullConsecutive = 0;  
int  battLowConsecutive  = 0;  

// --- Variabel Latching Button ---
bool micPowerState    = true; 
int  buttonState      = HIGH; 
int  lastButtonState  = HIGH; 
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50; 

// --- CACHE & FLAG SENSOR ---
float lastAccX = 0, lastAccY = 0, lastAccZ = 0;
float lastGyrX = 0, lastGyrY = 0, lastGyrZ = 0;
bool maxConnected = false; 

// --- WATCHDOG MAX30100 ---
uint8_t lastFifoWrPtr = 0xFF;
int     maxStuckCount = 0;

// --- JAM DIGITAL ---
int bootHour = 0;
int bootMinute = 0;
unsigned long bootMillisForClock = 0;

volatile bool mpuDataReady = false;

void IRAM_ATTR mpuISR() {
    mpuDataReady = true;
}

// === CALLBACK BLE ===
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer, esp_ble_gatts_cb_param_t *param) {
        deviceConnected = true;
        pServer->updateConnParams(param->connect.remote_bda, 0x0C80, 0x1000, 0, 400);
        Serial.println("[BLE] Terhubung!");
    }
    void onDisconnect(BLEServer *pServer) {
        deviceConnected = false;
        Serial.println("[BLE] Terputus. Advertising akan direstart...");
        needsRestartAdvertising = true;
    }
};

void onBeatDetected() {
    unsigned long now = millis();
    if (lastBeatMs > 0 && rrCount < MAX_RR) {
        uint16_t rr = (uint16_t)(now - lastBeatMs);
        if (rr >= 300 && rr <= 1500) {
            rrBuffer[rrCount++] = rr;
        }
    }
    lastBeatMs = now;
}

// --- WATCHDOG MAX30100 ---
uint8_t readMaxReg(uint8_t reg) {
    Wire.beginTransmission(MAX30100_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) return 0xFF;
    Wire.requestFrom(MAX30100_ADDR, 1, true);
    return Wire.available() ? Wire.read() : 0xFF;
}

bool initMax30100() {
    if (!pox.begin()) {
        Serial.println("[WARN] ERROR: MAX30100 tidak terdeteksi!");
        return false;
    }
    Serial.println("[INFO] MAX30100 berhasil diinisialisasi.");
    pox.setOnBeatDetectedCallback(onBeatDetected);
    pox.setIRLedCurrent(MAX30100_LED_CURR_4_4MA);
    return true;
}

// --- JAM DIGITAL MANUAL ---
unsigned long getUptimeMs() {
    return (unsigned long)(esp_timer_get_time() / 1000ULL);
}

void setClockReference(int h, int m) {
    bootHour = h;
    bootMinute = m;
    bootMillisForClock = getUptimeMs(); 
}

void initClockManual() {
    // Menyetel waktu awal secara manual ke 15:30
    setClockReference(15, 30);
}

void getCurrentClock(int &outHour, int &outMinute) {
    unsigned long elapsedMin = (getUptimeMs() - bootMillisForClock) / 60000UL;
    unsigned long totalMin = (unsigned long)(bootHour * 60 + bootMinute) + elapsedMin;
    totalMin %= (24UL * 60UL);
    outHour = totalMin / 60;
    outMinute = totalMin % 60;
}


void checkMaxWatchdog() {
    if (!maxConnected) return;

    uint8_t wrPtr = readMaxReg(0x02); 

    if (wrPtr == lastFifoWrPtr) {
        maxStuckCount++;
        if (maxStuckCount >= 2) {
            Serial.println("[WATCHDOG] MAX30100 macet, re-init...");
            Wire.end();
            delay(10);
            Wire.begin(I2C_SDA, I2C_SCL);
            Wire.setClock(400000);   
            Wire.setTimeOut(50);
            maxConnected = initMax30100();
            maxStuckCount = 0;
        }
    } else {
        maxStuckCount = 0;
    }
    lastFifoWrPtr = wrPtr;
}

void i2s_install() {
    const i2s_config_t i2s_config = {
        .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = i2s_bits_per_sample_t(16),
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
        .intr_alloc_flags = 0,
        .dma_buf_count = 8,
        .dma_buf_len = 64,
        .use_apll = false
    };
    i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    const i2s_pin_config_t pin_config = {
        .bck_io_num   = I2S_SCK,
        .ws_io_num    = I2S_WS,
        .data_out_num = -1,
        .data_in_num  = I2S_SD
    };
    i2s_set_pin(I2S_PORT, &pin_config);
}

int getBatteryData(float &vBateraiOut) {
    uint32_t sumMv = 0;
    for (int i = 0; i < BATT_ADC_SAMPLES; i++) {
        sumMv += analogReadMilliVolts(BATT_PIN);
    }
    uint32_t adc_millivolts = sumMv / BATT_ADC_SAMPLES;
    float v_adc = adc_millivolts / 1000.0;
    float v_baterai = v_adc * BATT_DIVIDER_RATIO; 
    vBateraiOut = v_baterai; 
    float v_min = 3.2; 
    float v_max = 4.2; 
    float persentase = ((v_baterai - v_min) / (v_max - v_min)) * 100.0;
    if (persentase > 100.0) persentase = 100.0;
    if (persentase < 0.0) persentase = 0.0;
    return (int)persentase;
}

void printBatteryStatus() {
    float v_baterai;
    int percent = getBatteryData(v_baterai);
    Serial.print("Baterai: "); 
    Serial.print(percent); 
    Serial.print("% ("); 
    Serial.print(v_baterai, 2); 
    Serial.print("V) | MIC State: ");
    Serial.println(micPowerState ? "ON" : "OFF");
}

// ====================================================================
// FUNGSI UPDATE OLED U8G2 (Jam Besar di Tengah)
// ====================================================================
void updateOLED(int battPercent, bool isBLEInitialized, bool isBLEConnected, bool isMicOn, unsigned long now) {
    u8g2.clearBuffer(); 

    // --- 1. STATUS BAR ---
    u8g2.setFont(u8g2_font_7x13B_tr);  

    if (isBLEInitialized) {
        int bx = 3, by = 1; 
        u8g2.drawLine(bx + 4, by,      bx + 4, by + 14); 
        u8g2.drawLine(bx + 4, by,      bx + 8, by + 4);  
        u8g2.drawLine(bx + 8, by + 4,  bx + 4, by + 7);  
        u8g2.drawLine(bx + 4, by + 7,  bx + 8, by + 10); 
        u8g2.drawLine(bx + 8, by + 10, bx + 4, by + 14); 
        if (isBLEConnected) {
            u8g2.drawDisc(bx + 8, by, 2); 
        }
    }

    int mx = 22, my = 1;
    if (isMicOn) {
        u8g2.drawRBox(mx, my, 7, 9, 3);
    } else {
        u8g2.drawRFrame(mx, my, 7, 9, 3);
    }
    u8g2.drawVLine(mx + 3, my + 9, 3);           
    u8g2.drawHLine(mx, my + 12, 7);              

    String battStr = String(battPercent) + "%";
    int battStrWidth = u8g2.getStrWidth(battStr.c_str());
    u8g2.drawStr(128 - battStrWidth, 13, battStr.c_str());

    u8g2.drawLine(0, 17, 128, 17);

    // --- 2. NOTIFIKASI "BLE CONNECTED" ---
    if (now < connectNotifUntil) {
        u8g2.setFont(u8g2_font_6x10_tr);
        const char* notifText = "BLE Connected";
        int notifWidth = u8g2.getStrWidth(notifText);
        u8g2.drawBox(0, 19, 128, 12);
        u8g2.setDrawColor(0);
        u8g2.drawStr((128 - notifWidth) / 2, 28, notifText);
        u8g2.setDrawColor(1);
    }

    // --- 3. KONTEN UTAMA (JAM DIGITAL) ---
    int clockH, clockM;
    getCurrentClock(clockH, clockM);
    char clockStr[6];
    snprintf(clockStr, sizeof(clockStr), "%02d:%02d", clockH, clockM);
    
    // Font besar di posisi tengah
    u8g2.setFont(u8g2_font_logisoso24_tr); 
    int clockStrWidth = u8g2.getStrWidth(clockStr);
    u8g2.drawStr((128 - clockStrWidth) / 2, 56, clockStr);

    u8g2.sendBuffer(); 
}

// ====================================================================
// FUNGSI KONTROL MPU6050
// ====================================================================
bool readMPU(float &accX, float &accY, float &accZ, float &gyrX, float &gyrY, float &gyrZ) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    if (Wire.endTransmission(false) != 0) return false; 
    uint8_t received = Wire.requestFrom(MPU_ADDR, 14, true);
    if (received != 14) return false; 
    
    int16_t rawAX = Wire.read() << 8 | Wire.read();
    int16_t rawAY = Wire.read() << 8 | Wire.read();
    int16_t rawAZ = Wire.read() << 8 | Wire.read();
    Wire.read(); Wire.read(); 
    int16_t rawGX = Wire.read() << 8 | Wire.read();
    int16_t rawGY = Wire.read() << 8 | Wire.read();
    int16_t rawGZ = Wire.read() << 8 | Wire.read();

    accX = (rawAX / 16384.0f) * 9.81f;
    accY = (rawAY / 16384.0f) * 9.81f;
    accZ = (rawAZ / 16384.0f) * 9.81f;
    gyrX = rawGX / 131.0f;               
    gyrY = rawGY / 131.0f;
    gyrZ = rawGZ / 131.0f;
    return true;
}

void configureMPU_Normal() {
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x6B); Wire.write(0x00); Wire.endTransmission(true);
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x19); Wire.write(39);   Wire.endTransmission(true);
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x1A); Wire.write(0x03); Wire.endTransmission(true);
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x37); Wire.write(0x00); Wire.endTransmission(true);
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x38); Wire.write(0x01); Wire.endTransmission(true); 
}

// ====================================================================
// SETUP
// ====================================================================
void setup() {
    Serial.begin(115200);
    pinMode(BTN_PIN, INPUT_PULLUP);
    pinMode(MIC_VCC_PIN, OUTPUT);
    pinMode(TRANSISTOR_PIN, OUTPUT);
    
    pinMode(MPU_INT_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(MPU_INT_PIN), mpuISR, RISING);
    
    digitalWrite(MIC_VCC_PIN, micPowerState ? HIGH : LOW);
    digitalWrite(TRANSISTOR_PIN, LOW);

    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);
    Wire.setTimeOut(50);

    u8g2.begin();
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_logisoso16_tr);
    int readyWidth = u8g2.getStrWidth("READY");
    u8g2.drawStr((128 - readyWidth) / 2, 40, "READY");
    u8g2.sendBuffer();

    configureMPU_Normal();
    
    // Memulai jam dari 15:30
    initClockManual(); 

    maxConnected = initMax30100();

    i2s_install();
    i2s_start(I2S_PORT);

    // === BLE SETUP ===
    BLEDevice::setMTU(512);              
    BLEDevice::init("Circadian");
    
    esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_DEFAULT, ESP_PWR_LVL_N21);
    esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_N21);
    esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_SCAN, ESP_PWR_LVL_N21);
    
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());
    BLEService *pService = pServer->createService(SERVICE_UUID);
    
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pCharacteristic->addDescriptor(new BLE2902());
    pCharacteristic->setValue("Menunggu epoch pertama...");

    pService->start();
    
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinInterval(0x0C80); 
    pAdvertising->setMaxInterval(0x1000);
    BLEDevice::startAdvertising();
    bleInitialized = true;  

    unsigned long startMs = millis();
    epochStart   = startMs;
    lastOledMs   = startMs;
    lastSerialMs = startMs;
    lastTransistorMs = startMs;
    lastWatchdogMs = startMs;
}

// ====================================================================
// LOOP
// ====================================================================
void loop() {
    unsigned long now = millis();

    // --- RESTART ADVERTISING (dari callback disconnect) ---
    if (needsRestartAdvertising && !deviceConnected) {
        needsRestartAdvertising = false;
        delay(100);
        BLEDevice::startAdvertising();
        Serial.println("[BLE] Advertising direstart.");
    }

    // --- BACA MPU ---
    if (mpuDataReady) {
        mpuDataReady = false;
        readMPU(lastAccX, lastAccY, lastAccZ, lastGyrX, lastGyrY, lastGyrZ);
    }

    if (now - lastTransistorMs >= TRANSISTOR_INTERVAL) {
        float vBattForTR;
        int battPercent = getBatteryData(vBattForTR);

        if (battPercent >= 100) {
            battFullConsecutive++;
            battLowConsecutive = 0;
        } else if (battPercent <= 0) {
            battLowConsecutive++;
            battFullConsecutive = 0;
        } else {
            battFullConsecutive = 0;
            battLowConsecutive  = 0;
        }

        bool trShouldBeOn = (battFullConsecutive >= BATT_TRIGGER_MIN_CONSECUTIVE) ||
                            (battLowConsecutive  >= BATT_TRIGGER_MIN_CONSECUTIVE);
        transistorState = trShouldBeOn;
        digitalWrite(TRANSISTOR_PIN, transistorState ? HIGH : LOW);
        lastTransistorMs = now;
    }

    int reading = digitalRead(BTN_PIN);
    if (reading != lastButtonState) lastDebounceTime = now;
    if ((now - lastDebounceTime) > debounceDelay) {
        if (reading != buttonState) {
            buttonState = reading;
            if (buttonState == LOW) {
                micPowerState = !micPowerState; 
                digitalWrite(MIC_VCC_PIN, micPowerState ? HIGH : LOW);
                Serial.print("[SISTEM] Status Mic Diubah: ");
                Serial.println(micPowerState ? "ON" : "OFF");
            }
        }
    }
    lastButtonState = reading;

    if (maxConnected) {
        pox.update();
    }

    if (now - lastWatchdogMs >= WATCHDOG_INTERVAL) {
        checkMaxWatchdog();
        lastWatchdogMs = now;
    }

    // --- DETEKSI TRANSISI CONNECT BLE ---
    if (deviceConnected && !prevDeviceConnected) {
        connectNotifUntil = now + CONNECT_NOTIF_DURATION;
        float vBattForOled;
        int battPercentForOled = getBatteryData(vBattForOled);
        updateOLED(battPercentForOled, bleInitialized, deviceConnected, micPowerState, now);
        lastOledMs = now;
    }
    prevDeviceConnected = deviceConnected;

    int16_t sampleBuffer[64];
    size_t  bytesIn = 0;
    i2s_read(I2S_PORT, sampleBuffer, sizeof(sampleBuffer), &bytesIn, 0);
    int samplesRead = bytesIn / 2;
    if (samplesRead > 0 && micPowerState) {
        float frameRms = 0.0f;
        int   frameZcr = 0;
        int16_t prev = 0;
        for (int i = 0; i < samplesRead; i++) {
            float s = sampleBuffer[i] / 32768.0f;  
            frameRms += s * s;
            if (i > 0 && ((sampleBuffer[i] >= 0) != (prev >= 0))) frameZcr++;
            prev = sampleBuffer[i];
        }
        audioRmsAccum  += sqrtf(frameRms / samplesRead);
        audioZcrAccum  += frameZcr;
        audioFrameCount++;
    }

    if (now - lastSerialMs >= LIVE_INTERVAL) {
        float tempRms = (audioFrameCount > 0) ? audioRmsAccum / audioFrameCount : 0.0f;
        float currentBPM = maxConnected ? pox.getHeartRate() : 0.0f;

        Serial.print("[PREVIEW 3s] BPM: "); Serial.print(currentBPM, 0);
        if (!maxConnected) Serial.print(" (Tidak tersambung)");
        
        Serial.print(" | ACC X: "); Serial.print(lastAccX, 1); 
        Serial.print(" | Audio RMS: "); Serial.print(tempRms, 4);
        Serial.print(" | TR State: "); Serial.println(transistorState ? "ON" : "OFF");
        
        printBatteryStatus(); 
        lastSerialMs = now;
    }

    if (now - lastOledMs >= OLED_INTERVAL) {
        float vBattForOled;
        int   battPercentForOled = getBatteryData(vBattForOled);

        // Update Layar
        updateOLED(battPercentForOled, bleInitialized, deviceConnected, micPowerState, now);
        lastOledMs = now;
    }

    if (now - epochStart >= EPOCH_MS) {
        float avgRms = (audioFrameCount > 0) ? audioRmsAccum / audioFrameCount : 0.0f;
        
        char rrJson[350] = "["; 
        for (int i = 0; i < rrCount; i++) {
            char tmp[8];
            snprintf(tmp, sizeof(tmp), "%d", rrBuffer[i]);
            strncat(rrJson, tmp, sizeof(rrJson) - strlen(rrJson) - 1);
            if (i < rrCount - 1) strncat(rrJson, ",", sizeof(rrJson) - strlen(rrJson) - 1);
        }
        strncat(rrJson, "]", sizeof(rrJson) - strlen(rrJson) - 1);

        float tempVBatt;
        int currentBattPercent = getBatteryData(tempVBatt);
        float currentBPM = maxConnected ? pox.getHeartRate() : 0.0f;

        Serial.println("\n========= EPOCH REPORT (30s) =========");
        Serial.print("Battery    : "); Serial.print(currentBattPercent); Serial.println("%");
        
        Serial.print("BPM (avg)  : "); Serial.print(currentBPM, 0);
        if (!maxConnected) {
            Serial.println("  --> [Status: Tidak Tersambung]");
        } else {
            Serial.println();
        }
        
        Serial.print("RR count   : "); Serial.println(rrCount);
        Serial.print("Audio RMS  : "); Serial.println(avgRms, 4);
        Serial.println("======================================\n");
        
        char blePayload[600];
        snprintf(blePayload, sizeof(blePayload),
            "{\"uid\":\"%s\",\"bat\":%d,\"acc\":[%.2f,%.2f,%.2f],\"gyr\":[%.2f,%.2f,%.2f],\"bpm\":%.0f,\"rr\":%s,\"aRms\":%.4f,\"aZcr\":%d}",
            USER_ID, currentBattPercent,
            lastAccX, lastAccY, lastAccZ,
            lastGyrX, lastGyrY, lastGyrZ,
            currentBPM, rrJson, avgRms,
            audioFrameCount > 0 ? (int)(audioZcrAccum / audioFrameCount) : 0
        );

        if (pCharacteristic != nullptr) {
            pCharacteristic->setValue(blePayload);
            if (deviceConnected) pCharacteristic->notify();
        }

        rrCount         = 0;
        audioRmsAccum   = 0.0f;
        audioZcrAccum   = 0;
        audioFrameCount = 0;
        epochStart = now;
    }

    delay(1);
}
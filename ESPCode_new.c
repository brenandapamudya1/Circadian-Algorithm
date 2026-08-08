#include <Wire.h>
#include "MAX30100_PulseOximeter.h"
#include <driver/i2s.h>
#include <math.h>                  

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define USER_ID     "user_001" 

// PIN CONFIG ESP32 S3 
// I2C Bus 0 — MAX30100
#define I2C0_SDA 8
#define I2C0_SCL 9

// I2C Bus 1 — MPU6050
#define I2C1_SDA 10
#define I2C1_SCL 11
#define MPU_ADDR 0x68

// I2S — INMP441
#define I2S_WS   6
#define I2S_SCK  5
#define I2S_SD   7
#define I2S_PORT I2S_NUM_0

// BLE Config
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Epoch Config
const unsigned long EPOCH_MS = 30000UL; 

// INSTANSIASI OBJEK 
TwoWire I2C_MPU = TwoWire(1);
PulseOximeter pox;

// BLE
BLECharacteristic *pCharacteristic = nullptr;
bool deviceConnected = false;

// RR INTERVAL BUFFER
#define MAX_RR  60                 // maks 60 beat per 30 detik (120 BPM)
uint16_t rrBuffer[MAX_RR];
int      rrCount      = 0;
unsigned long lastBeatMs = 0;

// AKUMULATOR AUDIO
float audioRmsAccum  = 0.0f;
long  audioZcrAccum  = 0;
int   audioFrameCount = 0;

// TIMING
unsigned long epochStart = 0;

// DEBUG SERIAL INTERVAL 
unsigned long lastSerialMs = 0;


// Callback BLE 
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) {
        deviceConnected = true;
        Serial.println("[BLE] Perangkat terhubung!");
    }
    void onDisconnect(BLEServer *pServer) {
        deviceConnected = false;
        Serial.println("[BLE] Perangkat terputus. Restart advertising...");
        BLEDevice::startAdvertising();
    }
};



// CALLBACK HEARTBEAT 
void onBeatDetected() {
    unsigned long now = millis();
    if (lastBeatMs > 0 && rrCount < MAX_RR) {
        uint16_t rr = (uint16_t)(now - lastBeatMs);
        if (rr >= 300 && rr <= 1500) {
            rrBuffer[rrCount++] = rr;
        }
    }
    lastBeatMs = now;
    Serial.println("♥ [BEAT]");
}





// SETUP I2S
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


// SETUP
void setup() {
    Serial.begin(115200);
    Serial.println("=========================================");
    Serial.println("  BIPOLYZER Circadian Sensor Node v2.0  ");
    Serial.println("=========================================");

    // 1. Inisialisasi I2C Bus
    Wire.begin(I2C0_SDA, I2C0_SCL);
    Wire.setClock(400000);
    I2C_MPU.begin(I2C1_SDA, I2C1_SCL);
    I2C_MPU.setClock(400000);

    // 2. MPU6050 — bangunkan dari sleep mode
    I2C_MPU.beginTransmission(MPU_ADDR);
    I2C_MPU.write(0x6B);   // Register Power Management 1
    I2C_MPU.write(0x00);   
    byte mpuErr = I2C_MPU.endTransmission(true);
    if (mpuErr == 0) {
        Serial.println("MPU6050  [OK]");
    } else {
        Serial.println("ERROR: MPU6050 tidak merespons!");
        while (1);
    }

    // 3. MAX30100 
    if (!pox.begin()) {
        Serial.println("ERROR: MAX30100 tidak ditemukan!");
        while (1);
    }
    pox.setOnBeatDetectedCallback(onBeatDetected);  // RR buffer aktif
    Serial.println("MAX30100 [OK]");

    // 4. INMP441
    i2s_install();
    i2s_start(I2S_PORT);
    Serial.println("INMP441  [OK]");

    // 5. BLE Setup
    BLEDevice::setMTU(512);              
    BLEDevice::init("Circadian");
    Serial.println("[BLE] Bluetooth menyala, nama: Circadian");

    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    pCharacteristic->addDescriptor(new BLE2902());
    pCharacteristic->setValue("Menunggu epoch pertama (30 detik)...");
    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMaxPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising aktif. Cari \"Circadian\" di aplikasi.");

    epochStart = millis();
    Serial.println("\n[SIAP] Mengumpulkan data... Epoch pertama dikirim dalam 30 detik.");
    Serial.println("=========================================\n");
}


// LOOP
void loop() {
    unsigned long now = millis();

    // PRIORITAS 1: Update sensor
    pox.update();

    // INMP441
    int16_t sampleBuffer[64];
    size_t  bytesIn = 0;
    i2s_read(I2S_PORT, &sampleBuffer, sizeof(sampleBuffer), &bytesIn, 0);

    // Hitung RMS + ZCR dari frame audio
    int samplesRead = bytesIn / 2;
    if (samplesRead > 0) {
        float frameRms = 0.0f;
        int   frameZcr = 0;
        int16_t prev = 0;
        for (int i = 0; i < samplesRead; i++) {
            float s = sampleBuffer[i] / 32768.0f;  // normalize -1..+1
            frameRms += s * s;
            // Zero-crossing
            if (i > 0 && ((sampleBuffer[i] >= 0) != (prev >= 0))) {
                frameZcr++;
            }
            prev = sampleBuffer[i];
        }
        frameRms = sqrtf(frameRms / samplesRead);
        audioRmsAccum  += frameRms;
        audioZcrAccum  += frameZcr;
        audioFrameCount++;
    }

    // Debug serial setiap 1 detik
    if (now - lastSerialMs >= 1000) {
        Serial.print("[LIVE] BPM: ");
        Serial.print(pox.getHeartRate(), 0);
        Serial.print(" | RR count: ");
        Serial.print(rrCount);
        Serial.print(" | Audio frames: ");
        Serial.println(audioFrameCount);
        lastSerialMs = now;
    }

    // Kirim epoch BLE setiap 30 detik
    if (now - epochStart >= EPOCH_MS) {

        // Accel
        I2C_MPU.beginTransmission(MPU_ADDR);
        I2C_MPU.write(0x3B);
        I2C_MPU.endTransmission(false);
        I2C_MPU.requestFrom(MPU_ADDR, 6, true);
        int16_t rawAX = I2C_MPU.read() << 8 | I2C_MPU.read();
        int16_t rawAY = I2C_MPU.read() << 8 | I2C_MPU.read();
        int16_t rawAZ = I2C_MPU.read() << 8 | I2C_MPU.read();

        // Gyro
        I2C_MPU.beginTransmission(MPU_ADDR);
        I2C_MPU.write(0x43);
        I2C_MPU.endTransmission(false);
        I2C_MPU.requestFrom(MPU_ADDR, 6, true);
        int16_t rawGX = I2C_MPU.read() << 8 | I2C_MPU.read();
        int16_t rawGY = I2C_MPU.read() << 8 | I2C_MPU.read();
        int16_t rawGZ = I2C_MPU.read() << 8 | I2C_MPU.read();

        // Konversi satuan fisik
        float accX = (rawAX / 16384.0f) * 9.81f;
        float accY = (rawAY / 16384.0f) * 9.81f;
        float accZ = (rawAZ / 16384.0f) * 9.81f;
        float gyrX = rawGX / 131.0f;               
        float gyrY = rawGY / 131.0f;
        float gyrZ = rawGZ / 131.0f;

        // Rata-rata audio epoch
        float avgRms = (audioFrameCount > 0)
                       ? audioRmsAccum / audioFrameCount : 0.0f;
        int   avgZcr = (audioFrameCount > 0)
                       ? (int)(audioZcrAccum / audioFrameCount) : 0;

        // Bangun string JSON array RR interval
        char rrJson[350] = "[";
        for (int i = 0; i < rrCount; i++) {
            char tmp[8];
            snprintf(tmp, sizeof(tmp), "%d", rrBuffer[i]);
            strncat(rrJson, tmp, sizeof(rrJson) - strlen(rrJson) - 1);
            if (i < rrCount - 1)
                strncat(rrJson, ",", sizeof(rrJson) - strlen(rrJson) - 1);
        }
        strncat(rrJson, "]", sizeof(rrJson) - strlen(rrJson) - 1);

        // CETAK RINGKASAN EPOCH KE SERIAL
        Serial.println("\n========= EPOCH REPORT (30s) =========");
        Serial.print("User ID    : "); Serial.println(USER_ID);
        Serial.print("Accel X/Y/Z: ");
        Serial.print(accX, 2); Serial.print(", ");
        Serial.print(accY, 2); Serial.print(", ");
        Serial.println(accZ, 2);
        Serial.print("Gyro  X/Y/Z: ");
        Serial.print(gyrX, 2); Serial.print(", ");
        Serial.print(gyrY, 2); Serial.print(", ");
        Serial.println(gyrZ, 2);
        Serial.print("BPM (avg)  : "); Serial.println(pox.getHeartRate(), 0);
        Serial.print("RR count   : "); Serial.print(rrCount);
        Serial.print(" | RR: "); Serial.println(rrJson);
        Serial.print("Audio RMS  : "); Serial.println(avgRms, 4);
        Serial.print("Audio ZCR  : "); Serial.println(avgZcr);
        Serial.println("======================================\n");
        
        // JSON Payload
        char blePayload[550];
        snprintf(blePayload, sizeof(blePayload),
            "{"
            "\"uid\":\"%s\","
            "\"acc\":[%.2f,%.2f,%.2f],"
            "\"gyr\":[%.2f,%.2f,%.2f],"
            "\"bpm\":%.0f,"
            "\"rr\":%s,"
            "\"aRms\":%.4f,"
            "\"aZcr\":%d"
            "}",
            USER_ID,
            accX, accY, accZ,
            gyrX, gyrY, gyrZ,
            pox.getHeartRate(),
            rrJson,
            avgRms,
            avgZcr
        );

        // BLE Notify
        if (pCharacteristic != nullptr) {
            pCharacteristic->setValue(blePayload);
            if (deviceConnected) {
                pCharacteristic->notify();
                Serial.print("[BLE] Terkirim (");
                Serial.print(strlen(blePayload));
                Serial.println(" bytes)");
                Serial.println(blePayload);
            } else {
                Serial.println("[BLE] Tidak ada klien terhubung. Data disimpan untuk dibaca.");
            }
        }

        // Reset Akumulator
        rrCount         = 0;
        audioRmsAccum   = 0.0f;
        audioZcrAccum   = 0;
        audioFrameCount = 0;
        epochStart      = now;
    }
}

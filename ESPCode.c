#include <Wire.h>
#include "MAX30100_PulseOximeter.h"
#include <driver/i2s.h>
// Bluetooth Low Energy
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>  // Diperlukan untuk mengaktifkan fitur NOTIFY

// ================= KONFIGURASI PIN ESP32-S3 =================
// I2C Bus 0 (Khusus untuk MAX30100)
#define I2C0_SDA 8
#define I2C0_SCL 9



// I2C Bus 1 (Khusus untuk MPU6050)
#define I2C1_SDA 10
#define I2C1_SCL 11
#define MPU_ADDR 0x68 // Alamat I2C standar MPU6050

// Pin I2S (Untuk Mikrofon INMP441)
#define I2S_WS 6
#define I2S_SCK 5
#define I2S_SD 7
#define I2S_PORT I2S_NUM_0

//Bluetooth Low Energy
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ================= INSTANSIASI OBJEK =================
TwoWire I2C_MPU = TwoWire(1); // Bus I2C Independen untuk MPU6050
PulseOximeter pox;

// Pointer global agar karakteristik BLE bisa diakses dari loop()
BLECharacteristic *pCharacteristic = nullptr;
bool deviceConnected = false;

// ================= CALLBACK KONEKSI BLE =================
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) {
        deviceConnected = true;
        Serial.println("[BLE] Perangkat terhubung!");
    }
    void onDisconnect(BLEServer *pServer) {
        deviceConnected = false;
        Serial.println("[BLE] Perangkat terputus, memulai ulang advertising...");
        BLEDevice::startAdvertising(); // Otomatis advertise lagi setelah disconnect
    }
};

// ================= VARIABEL TIMING (NON-BLOCKING) =================
unsigned long waktuLaporanTerakhir = 0;
const unsigned long intervalLaporan = 1000;

// ================= CALLBACK MAX30100 =================
void onBeatDetected() {
    Serial.println("♥ [BEAT]");
}

// ================= FUNGSI SETUP I2S =================
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
        .bck_io_num = I2S_SCK,
        .ws_io_num = I2S_WS,
        .data_out_num = -1,
        .data_in_num = I2S_SD
    };
    i2s_set_pin(I2S_PORT, &pin_config);
}

// ================= SETUP UTAMA =================
void setup() {
    Serial.begin(115200);
    
    // 1. Inisialisasi Bus I2C
    Wire.begin(I2C0_SDA, I2C0_SCL);     // Bus untuk MAX
    Wire.setClock(400000);
    
    I2C_MPU.begin(I2C1_SDA, I2C1_SCL);  // Bus untuk MPU
    I2C_MPU.setClock(400000);

    Serial.println("=========================================");
    Serial.println("Inisialisasi Sistem (Bypass Kloning)...");
    Serial.println("=========================================");

    // 2. Inisialisasi MPU6050 (Manual Raw I2C - Tanpa Library)
    I2C_MPU.beginTransmission(MPU_ADDR);
    I2C_MPU.write(0x6B); // Mengakses register Power Management
    I2C_MPU.write(0x00); // Mengirim angka 0 untuk membangunkan MPU6050 dari mode Sleep
    byte mpu_error = I2C_MPU.endTransmission(true);
    
    if (mpu_error == 0) {
        Serial.println("MPU6050  [OK] -> Berhasil dibangunkan secara manual");
    } else {
        Serial.println("ERROR: MPU6050 tidak merespons! Cek kabel di pin 10 & 11.");
        while (1);
    }

    // 3. Inisialisasi MAX30100
    if (!pox.begin()) {
        Serial.println("ERROR: MAX30100 tidak ditemukan!");
        while (1);
    }
    pox.setOnBeatDetectedCallback(onBeatDetected);
    Serial.println("MAX30100 [OK]");

    // 4. Inisialisasi INMP441
    i2s_install();
    i2s_start(I2S_PORT);
    Serial.println("INMP441  [OK]");

    Serial.println("Sistem Siap! Memulai pembacaan...");
    Serial.println("=========================================\n");

    // 5. Inisialisasi Bluetooth Low Energy
    BLEDevice::init("Circadian"); // <-- Nama yang akan muncul saat scan Bluetooth
    Serial.println("[BLE] Bluetooth menyala, nama: Circadian");

    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks()); // Pantau koneksi/diskoneksi

    BLEService *pService = pServer->createService(SERVICE_UUID);

    // Buat karakteristik dengan READ + NOTIFY agar ESP bisa kirim data ke HP
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    // Descriptor wajib agar fitur NOTIFY bisa diaktifkan oleh klien (HP)
    pCharacteristic->addDescriptor(new BLE2902());
    pCharacteristic->setValue("Menunggu data sensor...");
    pService->start();

    // 6. Start Advertising agar nama "Circadian" muncul saat scan
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);  // Min interval ~3.75ms
    pAdvertising->setMaxPreferred(0x12);  // Max interval ~11.25ms (fix: was setMinPreferred)
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising aktif. Cari \"Circadian\" di aplikasi Bluetooth.");
}

// ================= LOOP UTAMA =================
void loop() {
    unsigned long waktuSekarang = millis();
    
    // PRIORITAS 1: Eksekusi berkecepatan tinggi tanpa jeda
    pox.update(); 

    int16_t sampleBuffer[64];
    size_t bytesIn = 0;
    i2s_read(I2S_PORT, &sampleBuffer, sizeof(sampleBuffer), &bytesIn, 0); 
    
    // PRIORITAS 2: Cetak data setiap 1 detik
    if (waktuSekarang - waktuLaporanTerakhir >= intervalLaporan) {
        
        // --- PROSES BACA RAW I2C MPU6050 ---
        I2C_MPU.beginTransmission(MPU_ADDR);
        I2C_MPU.write(0x3B); // Meminta data mulai dari register Akselerasi Sumbu X
        I2C_MPU.endTransmission(false);
        I2C_MPU.requestFrom(MPU_ADDR, 6, true); // Menarik 6 byte data
        
        // Menggabungkan byte atas (High) dan bawah (Low)
        int16_t rawAccX = I2C_MPU.read() << 8 | I2C_MPU.read();
        int16_t rawAccY = I2C_MPU.read() << 8 | I2C_MPU.read();
        int16_t rawAccZ = I2C_MPU.read() << 8 | I2C_MPU.read();

        // Konversi dari data mentah ke satuan m/s^2 (Asumsi sensitivitas default +/- 2g)
        float accX = (rawAccX / 16384.0) * 9.81;
        float accY = (rawAccY / 16384.0) * 9.81;
        float accZ = (rawAccZ / 16384.0) * 9.81;

        // --- CETAK DATA KE LAYAR ---
        Serial.println("--- STATUS SENSOR ---");
        
        Serial.print("MPU Accel [X, Y, Z]: "); 
        Serial.print(accX); Serial.print(", ");
        Serial.print(accY); Serial.print(", ");
        Serial.print(accZ); Serial.println(" m/s^2");
        
        Serial.print("MAX BPM            : "); 
        Serial.print(pox.getHeartRate()); 
        Serial.print(" | SpO2: ");
        Serial.print(pox.getSpO2()); 
        Serial.println("%");
        
        Serial.print("INMP441 Data       : ");
        Serial.print(bytesIn);
        Serial.println(" bytes terbaca\n");

        // --- KIRIM DATA VIA BLE NOTIFY ---
        // Format JSON sederhana agar mudah di-parse oleh aplikasi mobile
        char blePayload[128];
        snprintf(blePayload, sizeof(blePayload),
            "{\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"bpm\":%.0f,\"mic\":%d}",
            accX, accY, accZ,
            pox.getHeartRate(),
            (int)bytesIn
        );

        if (pCharacteristic != nullptr) {
            pCharacteristic->setValue(blePayload);
            if (deviceConnected) {
                pCharacteristic->notify(); // Push data ke HP yang terhubung
                Serial.print("[BLE] Terkirim: ");
                Serial.println(blePayload);
            }
        }

        waktuLaporanTerakhir = waktuSekarang;
        
    }
}
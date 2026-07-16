import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';

// ── CONFIGURATIONS (Sesuai dengan ESPCode_new.c) ─────────────────────────────
export const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const DEVICE_NAME = 'Circadian';
export const DEFAULT_USER_ID = 'user_001';

// ── TYPES ──────────────────────────────────────────────────────────────────

/**
 * Struktur payload mentah yang dikirim oleh ESP32 (dalam bentuk JSON string).
 */
export interface RawSensorData {
  uid: string;
  acc: [number, number, number]; // [ax, ay, az] (m/s²)
  gyr: [number, number, number]; // [gx, gy, gz] (°/s)
  bpm: number;
  rr: number[];                  // RR intervals (ms)
  aRms: number;                  // Audio RMS
  aZcr: number;                  // Audio ZCR
}

/**
 * Format payload ternormalisasi yang dikonsumsi oleh Circadian pipeline (AGENT.md).
 */
export interface PipelinePayload {
  timestamp: string;
  user_id: string;
  hrv_raw: number[];
  audio_raw: {
    rms: number;
    zcr: number;
  };
  imu_raw: {
    accel_x: number[];
    accel_y: number[];
    accel_z: number[];
    gyro_x: number[];
    gyro_y: number[];
    gyro_z: number[];
  };
}

export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export type RawDataCallback = (data: RawSensorData) => void;
export type PipelineDataCallback = (data: PipelinePayload) => void;
export type ConnectionStateCallback = (state: ConnectionState) => void;

// ── UTILITIES ──────────────────────────────────────────────────────────────

/**
 * Base64 decoder mandiri untuk mengonversi string base64 dari react-native-ble-plx menjadi string UTF-8.
 */
function base64ToUtf8(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  // Hilangkan padding/whitespace jika ada
  const cleanBase64 = base64.replace(/=+$/, '');
  
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const encoded1 = chars.indexOf(cleanBase64[i] || 'A');
    const encoded2 = chars.indexOf(cleanBase64[i + 1] || 'A');
    const encoded3 = chars.indexOf(cleanBase64[i + 2] || 'A');
    const encoded4 = chars.indexOf(cleanBase64[i + 3] || 'A');

    const bytes1 = (encoded1 << 2) | (encoded2 >> 4);
    const bytes2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const bytes3 = ((encoded3 & 3) << 6) | encoded4;

    str += String.fromCharCode(bytes1);
    if (cleanBase64[i + 2] && cleanBase64[i + 2] !== '=') {
      str += String.fromCharCode(bytes2);
    }
    if (cleanBase64[i + 3] && cleanBase64[i + 3] !== '=') {
      str += String.fromCharCode(bytes3);
    }
  }
  
  try {
    return decodeURIComponent(escape(str));
  } catch (e) {
    return str; // Fallback jika bukan utf8 encode standard
  }
}

// ── BLE MANAGER CLASS ────────────────────────────────────────────────────────

class BipolyzerBleManager {
  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private characteristicSubscription: Subscription | null = null;

  // Web Specific Simulation Timers
  private mockTimer: any = null;
  private mockStreamInterval: any = null;

  // Callbacks
  private onStateChangeCallbacks: Set<ConnectionStateCallback> = new Set();
  private onRawDataCallbacks: Set<RawDataCallback> = new Set();
  private onPipelineDataCallbacks: Set<PipelineDataCallback> = new Set();

  constructor() {
    // Hindari menginisialisasi BleManager di Web karena native module tidak tersedia dan memicu crash
    if (Platform.OS !== 'web') {
      this.manager = new BleManager();
    } else {
      console.log('[BLE] Berjalan di Web. Simulator terintegrasi diaktifkan.');
    }
  }

  /**
   * Request permission yang dibutuhkan untuk scanning dan connection di Android.
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    if (Platform.OS === 'ios') {
      return true;
    }

    if (Platform.OS === 'android') {
      const apiLevel = parseInt(Platform.Version.toString(), 10);
      
      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Izin Lokasi Dibutuhkan',
            message: 'Aplikasi membutuhkan izin lokasi untuk mendeteksi perangkat Bluetooth.',
            buttonNeutral: 'Tanya Nanti',
            buttonNegative: 'Batal',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }

    return false;
  }

  /**
   * Mengupdate state koneksi internal dan memicu event listener.
   */
  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.onStateChangeCallbacks.forEach((cb) => cb(state));
  }

  /**
   * Mendapatkan status koneksi saat ini.
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Berlangganan (subscribe) ke perubahan state koneksi.
   */
  public subscribeStateChange(callback: ConnectionStateCallback): () => void {
    this.onStateChangeCallbacks.add(callback);
    return () => {
      this.onStateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Berlangganan ke data mentah (Raw Sensor Data) dari BLE.
   */
  public subscribeRawData(callback: RawDataCallback): () => void {
    this.onRawDataCallbacks.add(callback);
    return () => {
      this.onRawDataCallbacks.delete(callback);
    };
  }

  /**
   * Berlangganan ke data ternormalisasi (Pipeline Payload) siap konsumsi.
   */
  public subscribePipelineData(callback: PipelineDataCallback): () => void {
    this.onPipelineDataCallbacks.add(callback);
    return () => {
      this.onPipelineDataCallbacks.delete(callback);
    };
  }

  /**
   * Memulai pencarian (scan) perangkat BLE "Circadian" atau Service UUID terkait.
   */
  public async startScan(onDeviceFound?: (device: Device) => void): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[BLE] Scan dibatalkan karena izin ditolak.');
      return;
    }

    if (this.connectionState !== 'disconnected') {
      console.log('[BLE] Sudah dalam proses scan/koneksi.');
      return;
    }

    this.setConnectionState('scanning');
    console.log('[BLE] Memulai scan...');

    // Simulasi web
    if (Platform.OS === 'web') {
      this.mockTimer = setTimeout(() => {
        if (this.connectionState === 'scanning') {
          const mockDevice = {
            id: 'SIMULATOR-WEB-001',
            name: 'Circadian (Simulated)',
            localName: 'Circadian (Simulated)',
          } as any;
          console.log('[BLE Mock Web] Perangkat simulasi ditemukan.');
          onDeviceFound?.(mockDevice);
        }
      }, 1500);
      return;
    }

    // Native implementation
    if (this.manager) {
      this.manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('[BLE] Error saat scan:', error);
            this.setConnectionState('disconnected');
            this.manager?.stopDeviceScan();
            return;
          }

          if (device) {
            const isTargetName = device.name === DEVICE_NAME || device.localName === DEVICE_NAME;
            const isTargetUuid = device.serviceUUIDs?.includes(SERVICE_UUID);

            if (isTargetName || isTargetUuid) {
              console.log(`[BLE] Perangkat ditemukan: ${device.name || 'No Name'} (${device.id})`);
              if (onDeviceFound) {
                onDeviceFound(device);
              } else {
                this.connectToDevice(device);
              }
            }
          }
        }
      );
    }

    // Timeout scan setelah 15 detik
    setTimeout(() => {
      if (this.connectionState === 'scanning') {
        console.log('[BLE] Scan timeout.');
        this.stopScan();
      }
    }, 15000);
  }

  /**
   * Menghentikan proses scan BLE.
   */
  public stopScan(): void {
    if (Platform.OS === 'web') {
      if (this.mockTimer) {
        clearTimeout(this.mockTimer);
        this.mockTimer = null;
      }
      if (this.connectionState === 'scanning') {
        this.setConnectionState('disconnected');
      }
      console.log('[BLE Mock Web] Scan dihentikan.');
      return;
    }

    if (this.manager) {
      this.manager.stopDeviceScan();
    }
    if (this.connectionState === 'scanning') {
      this.setConnectionState('disconnected');
    }
    console.log('[BLE] Scan dihentikan.');
  }

  /**
   * Menghubungkan aplikasi ke perangkat BLE tertentu.
   */
  public async connectToDevice(device: Device): Promise<void> {
    this.stopScan();
    this.setConnectionState('connecting');
    console.log(`[BLE] Menghubungkan ke ${device.id}...`);

    if (Platform.OS === 'web') {
      setTimeout(() => {
        this.setConnectionState('connected');
        console.log('[BLE Mock Web] Berhasil terhubung (Simulasi)!');
        this.startMockDataStream();
      }, 1000);
      return;
    }

    if (this.manager) {
      try {
        const connectedDevice = await this.manager.connectToDevice(device.id);
        this.connectedDevice = connectedDevice;
        this.setConnectionState('connected');
        console.log('[BLE] Berhasil terhubung!');

        connectedDevice.onDisconnected((error, d) => {
          console.log(`[BLE] Perangkat terputus: ${d.id}`, error || '');
          this.handleDisconnect();
        });

        await connectedDevice.discoverAllServicesAndCharacteristics();
        this.subscribeToNotifications(connectedDevice);

      } catch (error) {
        console.error('[BLE] Gagal menghubungkan:', error);
        this.handleDisconnect();
      }
    }
  }

  /**
   * Berlangganan ke karakteristik GATT NOTIFY untuk menerima data stream.
   */
  private subscribeToNotifications(device: Device): void {
    if (this.characteristicSubscription) {
      this.characteristicSubscription.remove();
    }

    console.log(`[BLE] Subscribe ke karakteristik: ${CHARACTERISTIC_UUID}`);

    this.characteristicSubscription = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, char) => {
        if (error) {
          console.error('[BLE] Error pada data notification:', error);
          return;
        }

        if (char?.value) {
          try {
            const rawJsonStr = base64ToUtf8(char.value);
            const rawSensorData: RawSensorData = JSON.parse(rawJsonStr);
            
            // Trigger callbacks data mentah
            this.onRawDataCallbacks.forEach((cb) => cb(rawSensorData));

            const timestamp = new Date().toISOString();
            const normalizedPayload = this.normalizeToPipeline(rawSensorData, timestamp);

            // Trigger callbacks data pipeline
            this.onPipelineDataCallbacks.forEach((cb) => cb(normalizedPayload));

          } catch (e) {
            console.error('[BLE] Gagal memproses/parse data BLE:', e, 'Raw base64:', char.value);
          }
        }
      }
    );
  }

  /**
   * Normalisasi data mentah ESP32 ke struktur kontrak pipeline (sesuai spesifikasi ble_receiver.py).
   */
  private normalizeToPipeline(sensor: RawSensorData, ts: string): PipelinePayload {
    const acc = sensor.acc || [0.0, 0.0, 0.0];
    const gyr = sensor.gyr || [0.0, 0.0, 0.0];
    const rr = sensor.rr || [];

    return {
      timestamp: ts,
      user_id: sensor.uid || DEFAULT_USER_ID,
      hrv_raw: rr,
      audio_raw: {
        rms: sensor.aRms || 0.0,
        zcr: sensor.aZcr || 0,
      },
      imu_raw: {
        accel_x: [acc[0]],
        accel_y: [acc[1]],
        accel_z: [acc[2]],
        gyro_x: [gyr[0]],
        gyro_y: [gyr[1]],
        gyro_z: [gyr[2]],
      },
    };
  }

  /**
   * Memulai aliran simulasi data mentah berkala di browser web.
   */
  private startMockDataStream() {
    this.stopMockDataStream();
    console.log('[BLE Mock Web] Memulai aliran data simulasi sirkadian...');

    this.mockStreamInterval = setInterval(() => {
      if (this.connectionState !== 'connected') return;

      // Buat data sensor yang realistis
      const mockRawData: RawSensorData = {
        uid: 'user_mock_web',
        acc: [
          Number((Math.random() * 0.4 - 0.2).toFixed(3)),
          Number((Math.random() * 0.4 - 0.2).toFixed(3)),
          Number((9.8 + Math.random() * 0.3).toFixed(3)),
        ],
        gyr: [
          Number((Math.random() * 0.1 - 0.05).toFixed(3)),
          Number((Math.random() * 0.1 - 0.05).toFixed(3)),
          Number((Math.random() * 0.1 - 0.05).toFixed(3)),
        ],
        bpm: 65 + Math.floor(Math.random() * 20),
        rr: Array.from({ length: 25 }, () => 800 + Math.floor(Math.random() * 150)),
        aRms: Number((0.01 + Math.random() * 0.05).toFixed(4)),
        // aZcr adalah proxy vocal F0, buat naik turun sesekali untuk simulasi anomali (>2.0 zscore)
        aZcr: Math.random() > 0.85 ? 250 : 120 + Math.floor(Math.random() * 30),
      };

      // Siarkan ke subscriber
      this.onRawDataCallbacks.forEach((cb) => cb(mockRawData));
    }, 4000); // interval 4 detik agar demo terasa responsif
  }

  /**
   * Menghentikan aliran simulasi data mentah.
   */
  private stopMockDataStream() {
    if (this.mockStreamInterval) {
      clearInterval(this.mockStreamInterval);
      this.mockStreamInterval = null;
    }
  }

  /**
   * Membersihkan status saat perangkat terputus atau koneksi gagal.
   */
  private handleDisconnect(): void {
    if (Platform.OS === 'web') {
      this.stopMockDataStream();
    }
    if (this.characteristicSubscription) {
      this.characteristicSubscription.remove();
      this.characteristicSubscription = null;
    }
    this.connectedDevice = null;
    this.setConnectionState('disconnected');
  }

  /**
   * Memutuskan koneksi secara manual.
   */
  public async disconnect(): Promise<void> {
    if (Platform.OS === 'web') {
      console.log('[BLE Mock Web] Memutuskan koneksi simulasi...');
      this.handleDisconnect();
      return;
    }

    if (this.connectedDevice && this.manager) {
      console.log(`[BLE] Memutuskan koneksi manual dari ${this.connectedDevice.id}...`);
      try {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      } catch (error) {
        console.error('[BLE] Error saat memutuskan koneksi:', error);
      }
    }
    this.handleDisconnect();
  }

  /**
   * Menghancurkan manager instance dan membersihkan subscription.
   */
  public destroy(): void {
    this.stopScan();
    this.disconnect();
    this.onStateChangeCallbacks.clear();
    this.onRawDataCallbacks.clear();
    this.onPipelineDataCallbacks.clear();
  }
}

// Export singleton instance agar instance BleManager digunakan konsisten di seluruh app.
export const bleManager = new BipolyzerBleManager();

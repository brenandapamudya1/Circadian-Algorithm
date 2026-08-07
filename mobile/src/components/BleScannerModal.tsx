import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { bleManager, ConnectionState, BluetoothState } from '../services/bleManager';
import { styles } from '../constants/theme';

interface BleScannerModalProps {
  visible: boolean;
  connectionState: ConnectionState;
  scannedDevices: Device[];
  onConnect: (device: Device) => void;
  onDisconnect: () => void;
  onScan: () => void;
  onStopScan: () => void;
  onClose: () => void;
}

export const BleScannerModal: React.FC<BleScannerModalProps> = ({
  visible,
  connectionState,
  scannedDevices,
  onConnect,
  onDisconnect,
  onScan,
  onStopScan,
  onClose,
}) => {
  const [btState, setBtState] = useState<BluetoothState>('on');
  const [isChecking, setIsChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      cleanupPolling();
      return;
    }

    checkBt();
    return () => cleanupPolling();
  }, [visible]);

  const cleanupPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const checkBt = async () => {
    setIsChecking(true);
    const state = await bleManager.checkBluetoothState();
    setBtState(state);
    setIsChecking(false);

    if (state === 'on') {
      cleanupPolling();
      onScan();
    } else {
      cleanupPolling();
      pollRef.current = setInterval(async () => {
        const newState = await bleManager.checkBluetoothState();
        setBtState(newState);
        if (newState === 'on') {
          cleanupPolling();
          onScan();
        }
      }, 2000);
    }
  };

  if (!visible) return null;

  if (connectionState === 'connected') {
    return (
      <View style={styles.bleModalOverlay}>
        <View style={styles.bleModalContent}>
          <Text style={styles.bleModalTitle}>Koneksi Gelang Sirkadian</Text>
          <View style={bleLocal.connectedContainer}>
            <View style={bleLocal.connectedDotOn} />
            <Text style={bleLocal.connectedText}>Gelang saat ini terhubung!</Text>
          </View>
          <TouchableOpacity style={styles.bleDisconnectBtn} onPress={onDisconnect}>
            <Text style={styles.bleDisconnectBtnText}>Putuskan Koneksi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bleCloseBtn} onPress={onClose}>
            <Text style={styles.bleCloseBtnText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (btState !== 'on') {
    return (
      <View style={styles.bleModalOverlay}>
        <View style={styles.bleModalContent}>
          <Text style={styles.bleModalTitle}>Koneksi Gelang Sirkadian</Text>

          <View style={bleLocal.btWarningContainer}>
            <Text style={bleLocal.btWarningIcon}>📶</Text>
            <Text style={bleLocal.btWarningTitle}>Bluetooth Tidak Aktif</Text>
            <Text style={bleLocal.btWarningDesc}>
              Silakan aktifkan Bluetooth di pengaturan perangkat Anda untuk terhubung dengan gelang Bipolyzer.
            </Text>
            <View style={bleLocal.btPollingRow}>
              <ActivityIndicator size="small" color="#7B5EA7" />
              <Text style={bleLocal.btPollingText}>Menunggu Bluetooth dinyalakan...</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.bleCloseBtn} onPress={onClose}>
            <Text style={styles.bleCloseBtnText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bleModalOverlay}>
      <View style={styles.bleModalContent}>
        <Text style={styles.bleModalTitle}>Koneksi Gelang Sirkadian</Text>

        <Text style={styles.bleModalStatus}>
          Status: {connectionState === 'scanning' ? 'Mencari perangkat...' :
                   connectionState === 'connecting' ? 'Menghubungkan...' : 'Siap memindai'}
        </Text>

        <ScrollView style={styles.bleDeviceList} nestedScrollEnabled={true}>
          {scannedDevices.length > 0 ? (
            scannedDevices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.bleDeviceItem}
                onPress={() => onConnect(device)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bleDeviceName}>{device.name || 'Unknown Device'}</Text>
                  <Text style={styles.bleDeviceAddress}>{device.id}</Text>
                </View>
                <Text style={styles.bleDeviceConnectText}>Hubungkan ›</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.bleEmptyText}>
              {connectionState === 'scanning' ? 'Mencari gelang Bipolyzer...' :
               connectionState === 'connecting' ? 'Menghubungkan ke perangkat...' :
               'Belum ada perangkat ditemukan.'}
            </Text>
          )}
        </ScrollView>

        {connectionState !== 'scanning' && connectionState !== 'connecting' && (
          <TouchableOpacity style={styles.bleScanBtn} onPress={onScan}>
            <Text style={styles.bleScanBtnText}>Mulai Scan</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.bleCloseBtn}
          onPress={() => {
            onClose();
            onStopScan();
          }}
        >
          <Text style={styles.bleCloseBtnText}>Tutup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const bleLocal = {
  connectedContainer: {
    alignItems: 'center' as const,
    paddingVertical: 16,
  },
  connectedDotOn: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginBottom: 12,
  },
  connectedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2E1E43',
  },
  btWarningContainer: {
    alignItems: 'center' as const,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  btWarningIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  btWarningTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2E1E43',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  btWarningDesc: {
    fontSize: 13,
    color: '#8A7B9C',
    textAlign: 'center' as const,
    lineHeight: 19,
    marginBottom: 16,
  },
  btPollingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#F3EEF9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  btPollingText: {
    fontSize: 12,
    color: '#7B5EA7',
    fontWeight: '500' as const,
  },
};

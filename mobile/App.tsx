import React, { useState, useEffect } from 'react';
import { Platform, Image, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Device } from 'react-native-ble-plx';

import { bleManager, ConnectionState } from './src/services/bleManager';
import { syncService } from './src/services/syncService';
import { notificationService } from './src/services/notificationService';
import { PipelineResult } from './src/circadian/pipeline';
import { getRecentFeatureVectors, DbFeatureVector } from './src/database/queries';
import { styles } from './src/constants/theme';

import { HomeScreen } from './src/views/HomeScreen';
import { TrenScreen } from './src/views/TrenScreen';
import { SettingsScreen } from './src/views/SettingsScreen';
import { RiwayatScreen } from './src/views/RiwayatScreen';
import { BottomNav, TabName } from './src/components/BottomNav';
import { BleScannerModal } from './src/components/BleScannerModal';
import { LockScreen } from './src/components/LockScreen';
import { SplashScreen } from './src/components/SplashScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabName>('Beranda');
  const [bleConnectionState, setBleConnectionState] = useState<ConnectionState>('disconnected');
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [showBleModal, setShowBleModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [latestResult, setLatestResult] = useState<PipelineResult | null>(null);
  const [historicalVectors, setHistoricalVectors] = useState<DbFeatureVector[]>([]);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const loadHistory = async () => {
    try {
      const data = await getRecentFeatureVectors(30);
      setHistoricalVectors(data);
    } catch (err) {
      console.warn('Gagal memuat riwayat:', err);
    }
  };

  useEffect(() => {
    syncService.initialize();
    notificationService.initialize();
    notificationService.startDailySummarySchedule(21, 0);

    const unsubState = bleManager.subscribeStateChange((state) => {
      console.log(`[App] BLE state update: ${state}`);
      setBleConnectionState(state);
      if (state === 'disconnected') {
        setScannedDevices([]);
      }
    });

    const unsubPipeline = syncService.subscribePipelineResult((result) => {
      setLatestResult(result);
      loadHistory();
    });

    loadHistory();

    return () => {
      unsubState();
      unsubPipeline();
      notificationService.stopDailySummarySchedule();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'Riwayat') {
      loadHistory();
    }
  }, [activeTab]);

  const startScanning = async () => {
    setScannedDevices([]);
    await bleManager.startScan((device) => {
      setScannedDevices((prev) => {
        if (prev.some((d) => d.id === device.id)) return prev;
        return [...prev, device];
      });
    });
  };

  const handleConnect = async (device: Device) => {
    await bleManager.connectToDevice(device);
    setShowBleModal(false);
  };

  const handleDisconnect = async () => {
    await bleManager.disconnect();
  };

  const openBleScanner = () => {
    setShowBleModal(true);
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Bypolizer';
      // Favicon handling removed - not critical for demo
    }
  }, []);

  const bgStyle =
    activeTab === 'Tren' ? styles.bgTren
    : activeTab === 'Riwayat' ? styles.bgRiwayat
    : styles.bgBeranda;

  return (
    <>
      {isUnlocked && (
        <SafeAreaView style={[styles.container, bgStyle]}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {activeTab === 'Beranda' && (
              <HomeScreen
                latestResult={latestResult}
                bleConnectionState={bleConnectionState}
                onOpenSettings={() => setShowSettings(true)}
              />
            )}

            {activeTab === 'Tren' && (
              <TrenScreen historicalVectors={historicalVectors} />
            )}

            {activeTab === 'Riwayat' && (
              <RiwayatScreen historicalVectors={historicalVectors} />
            )}
          </ScrollView>

          <BottomNav activeTab={activeTab} onTabPress={setActiveTab} />
        </SafeAreaView>
      )}

      <BleScannerModal
        visible={showBleModal}
        connectionState={bleConnectionState}
        scannedDevices={scannedDevices}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onScan={startScanning}
        onStopScan={() => bleManager.stopScan()}
        onClose={() => setShowBleModal(false)}
      />

      {showSettings && (
        <SettingsScreen
          bleConnectionState={bleConnectionState}
          onOpenBleScanner={openBleScanner}
          onClose={() => setShowSettings(false)}
        />
      )}

      {!isUnlocked && (
        <LockScreen isUnlocked={isUnlocked} onUnlock={() => setIsUnlocked(true)} />
      )}

      <SplashScreen visible={showSplash} onFadeComplete={() => setShowSplash(false)} />
    </>
  );
}

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from '../constants/theme';

export type TabName = 'Beranda' | 'Tren' | 'Pengaturan' | 'Riwayat';

interface BottomNavProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

const tabs: { name: TabName; icon: any; label: string }[] = [
  { name: 'Beranda', icon: require('../../assets/ICON_HOMEPAGE/home_icon.png'), label: 'Beranda' },
  { name: 'Tren', icon: require('../../assets/ICON_HOMEPAGE/tren_icon.png'), label: 'Tren' },
  { name: 'Pengaturan', icon: require('../../assets/ICON_HOMEPAGE/settings_icon.png'), label: 'Pengaturan' },
  { name: 'Riwayat', icon: require('../../assets/ICON_HOMEPAGE/riwayat_icon.png'), label: 'Riwayat' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.navItem}
          onPress={() => onTabPress(tab.name)}
        >
          <Image
            source={tab.icon}
            style={[styles.navIconImg, activeTab === tab.name ? styles.navIconActive : styles.navIconInactive]}
          />
          <Text style={[styles.navText, activeTab === tab.name ? styles.navTextActive : styles.navTextInactive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

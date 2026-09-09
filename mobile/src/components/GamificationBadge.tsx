import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Badge } from '../services/gamificationService';
import { styles } from '../constants/theme';

interface GamificationBadgeProps {
  badge: Badge;
  unlocked: boolean;
  onPress?: (badge: Badge) => void;
}

export const GamificationBadge: React.FC<GamificationBadgeProps> = ({ badge, unlocked, onPress }) => {
  const Icon = unlocked ? badge.Icon : badge.lockedIcon;
  const bgColor = unlocked ? badge.bgColor : '#F0EAF8';
  const fgColor = unlocked ? badge.color : '#9B8CB0';
  const isHeartUnlocked = unlocked && badge.id === 'stable_7';

  return (
    <TouchableOpacity
      style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}
      onPress={() => onPress?.(badge)}
      activeOpacity={0.7}
    >
      <View style={[styles.badgeIconWrap, { backgroundColor: bgColor }]}>
        <Icon
          color={fgColor}
          size={unlocked ? 28 : 22}
          strokeWidth={2}
          fill={isHeartUnlocked ? fgColor : 'transparent'}
        />
      </View>
      <Text style={[styles.badgeName, !unlocked && styles.badgeNameLocked]} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={[styles.badgeDesc, !unlocked && styles.badgeDescLocked]} numberOfLines={2}>
        {unlocked ? badge.description : '???'}
      </Text>
    </TouchableOpacity>
  );
};

interface BadgeGridProps {
  badges: Badge[];
  unlockedIds: string[];
  onBadgePress?: (badge: Badge) => void;
}

export const BadgeGrid: React.FC<BadgeGridProps> = ({ badges, unlockedIds, onBadgePress }) => {
  return (
    <View style={styles.badgeGrid}>
      {badges.map((badge) => (
        <GamificationBadge
          key={badge.id}
          badge={badge}
          unlocked={unlockedIds.includes(badge.id)}
          onPress={onBadgePress}
        />
      ))}
    </View>
  );
};

interface StreakCounterProps {
  streak: number;
}

export const StreakCounter: React.FC<StreakCounterProps> = ({ streak }) => {
  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakIconWrap}>
        <Flame color="#FF6B35" size={24} strokeWidth={2} />
      </View>
      <View style={styles.streakInfo}>
        <Text style={styles.streakValue}>{streak}</Text>
        <Text style={styles.streakLabel}>Hari Berturut</Text>
      </View>
    </View>
  );
};

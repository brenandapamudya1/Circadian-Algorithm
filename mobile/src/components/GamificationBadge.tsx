import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Badge } from '../services/gamificationService';
import { styles } from '../constants/theme';

interface GamificationBadgeProps {
  badge: Badge;
  unlocked: boolean;
  onPress?: (badge: Badge) => void;
}

export const GamificationBadge: React.FC<GamificationBadgeProps> = ({ badge, unlocked, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}
      onPress={() => onPress?.(badge)}
      activeOpacity={0.7}
    >
      <Image
        source={unlocked ? badge.icon : badge.lockedIcon}
        style={[styles.badgeIconImg, !unlocked && styles.badgeIconImgLocked]}
        resizeMode="contain"
      />
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

const streakIcon = require('../../assets/BADGES/streak_fire.png');

export const StreakCounter: React.FC<StreakCounterProps> = ({ streak }) => {
  return (
    <View style={styles.streakContainer}>
      <Image source={streakIcon} style={styles.streakIconImg} resizeMode="contain" />
      <View style={styles.streakInfo}>
        <Text style={styles.streakValue}>{streak}</Text>
        <Text style={styles.streakLabel}>Hari Berturut</Text>
      </View>
    </View>
  );
};

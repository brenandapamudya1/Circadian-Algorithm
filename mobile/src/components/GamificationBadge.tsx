import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
      <Text style={[styles.badgeIcon, !unlocked && styles.badgeIconLocked]}>
        {unlocked ? badge.icon : '🔒'}
      </Text>
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
      <Text style={styles.streakIcon}>🔥</Text>
      <View style={styles.streakInfo}>
        <Text style={styles.streakValue}>{streak}</Text>
        <Text style={styles.streakLabel}>Hari Berturut</Text>
      </View>
    </View>
  );
};

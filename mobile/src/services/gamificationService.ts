import {
  getGamificationProgress,
  updateGamificationProgress,
  getRecentFeatureVectors,
} from '../database/queries';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: any;
  lockedIcon: any;
  condition: (state: GamificationState) => boolean;
}

export interface GamificationState {
  totalPoints: number;
  streakDays: number;
  lastActiveDate: string | null;
  badgesUnlocked: string[];
  totalDaysWithData: number;
  stableDays: number;
  totalEpochs: number;
}

const lockedIcon = require('../../assets/BADGES/badge_locked.png');

export const BADGES: Badge[] = [
  {
    id: 'first_connect',
    name: 'Pertama Kali',
    description: 'Berhasil menghubungkan gelang untuk pertama kali',
    icon: require('../../assets/BADGES/badge_chain.png'),
    lockedIcon,
    condition: (state) => state.totalDaysWithData > 0 || state.totalEpochs > 0,
  },
  {
    id: 'streak_3',
    name: 'Konsisten 3 Hari',
    description: 'Menggunakan aplikasi selama 3 hari berturut-turut',
    icon: require('../../assets/BADGES/badge_fire.png'),
    lockedIcon,
    condition: (state) => state.streakDays >= 3,
  },
  {
    id: 'streak_7',
    name: 'Streak Seminggu',
    description: 'Menggunakan aplikasi selama 7 hari berturut-turut',
    icon: require('../../assets/BADGES/badge_star.png'),
    lockedIcon,
    condition: (state) => state.streakDays >= 7,
  },
  {
    id: 'streak_30',
    name: 'Streak Sebulan',
    description: 'Menggunakan aplikasi selama 30 hari berturut-turut',
    icon: require('../../assets/BADGES/badge_crown.png'),
    lockedIcon,
    condition: (state) => state.streakDays >= 30,
  },
  {
    id: 'stable_7',
    name: 'Stabil Seminggu',
    description: 'Fase stabil selama 7 hari',
    icon: require('../../assets/BADGES/badge_green_heart.png'),
    lockedIcon,
    condition: (state) => state.stableDays >= 7,
  },
  {
    id: 'stable_30',
    name: 'Stabil Sebulan',
    description: 'Fase stabil selama 30 hari',
    icon: require('../../assets/BADGES/badge_diamond.png'),
    lockedIcon,
    condition: (state) => state.stableDays >= 30,
  },
  {
    id: 'data_collector',
    name: 'Data Collector',
    description: 'Mengumpulkan 100 epoch data',
    icon: require('../../assets/BADGES/badge_chart.png'),
    lockedIcon,
    condition: (state) => state.totalEpochs >= 100,
  },
];

function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getYesterdayString(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
}

export async function calculateStreak(): Promise<number> {
  const vectors = await getRecentFeatureVectors(500);
  if (vectors.length === 0) return 0;

  const uniqueDays = new Set(vectors.map(v => v.timestamp.split('T')[0]));
  const sortedDays = Array.from(uniqueDays).sort().reverse();

  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 0; i < sortedDays.length - 1; i++) {
    const current = new Date(sortedDays[i]);
    const next = new Date(sortedDays[i + 1]);
    const diffDays = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function calculateStableDays(): Promise<number> {
  const vectors = await getRecentFeatureVectors(500);
  const stableDaysSet = new Set(
    vectors.filter(v => v.circadian_valid === 1).map(v => v.timestamp.split('T')[0])
  );
  return stableDaysSet.size;
}

export async function getGamificationState(): Promise<GamificationState> {
  const progress = await getGamificationProgress();
  const streak = await calculateStreak();
  const vectors = await getRecentFeatureVectors(500);

  const uniqueDays = new Set(vectors.map(v => v.timestamp.split('T')[0]));
  const stableDays = await calculateStableDays();

  const state: GamificationState = {
    totalPoints: progress?.total_points ?? 0,
    streakDays: streak,
    lastActiveDate: progress?.last_active_date ?? null,
    badgesUnlocked: progress ? JSON.parse(progress.badges_unlocked || '[]') : [],
    totalDaysWithData: uniqueDays.size,
    stableDays,
    totalEpochs: vectors.length,
  };

  return state;
}

export async function checkAndUnlockBadges(): Promise<Badge[]> {
  const state = await getGamificationState();
  const newlyUnlocked: Badge[] = [];

  for (const badge of BADGES) {
    if (!state.badgesUnlocked.includes(badge.id) && badge.condition(state)) {
      newlyUnlocked.push(badge);
      state.badgesUnlocked.push(badge.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    const today = getTodayString();
    await updateGamificationProgress(
      state.totalPoints + newlyUnlocked.length * 10,
      state.streakDays,
      today,
      JSON.stringify(state.badgesUnlocked)
    );
  }

  return newlyUnlocked;
}

export async function updateStreak(): Promise<void> {
  const state = await getGamificationState();
  const today = getTodayString();

  if (state.lastActiveDate !== today) {
    await updateGamificationProgress(
      state.totalPoints,
      state.streakDays,
      today,
      JSON.stringify(state.badgesUnlocked)
    );
  }
}

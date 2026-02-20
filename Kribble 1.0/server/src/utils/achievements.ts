/**
 * Achievement System
 * Tracks and unlocks player achievements based on game activity
 */

import { logger } from './logger.js';
import { redis } from './redis.js';
import { getPlayerStats, updatePlayerStats } from '../db/index.js';

// Achievement definitions
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'games' | 'drawing' | 'guessing' | 'social' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  requirement: {
    type: 'count' | 'streak' | 'score' | 'special';
    value: number;
    metric: string;
  };
  points: number;
  secret?: boolean; // Hidden until unlocked
}

// Achievement unlock event
export interface AchievementUnlock {
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  points: number;
  unlockedAt: number;
}

// Achievement database
export const ACHIEVEMENTS: Achievement[] = [
  // Games played achievements
  {
    id: 'first_game',
    name: 'First Steps',
    description: 'Play your first game',
    icon: '🎮',
    category: 'games',
    tier: 'bronze',
    requirement: { type: 'count', value: 1, metric: 'gamesPlayed' },
    points: 10,
  },
  {
    id: 'veteran_10',
    name: 'Veteran',
    description: 'Play 10 games',
    icon: '🏆',
    category: 'games',
    tier: 'silver',
    requirement: { type: 'count', value: 10, metric: 'gamesPlayed' },
    points: 25,
  },
  {
    id: 'addict_50',
    name: 'Addict',
    description: 'Play 50 games',
    icon: '🎲',
    category: 'games',
    tier: 'gold',
    requirement: { type: 'count', value: 50, metric: 'gamesPlayed' },
    points: 50,
  },
  {
    id: 'legend_100',
    name: 'Legend',
    description: 'Play 100 games',
    icon: '👑',
    category: 'games',
    tier: 'platinum',
    requirement: { type: 'count', value: 100, metric: 'gamesPlayed' },
    points: 100,
  },
  {
    id: 'immortal_500',
    name: 'Immortal',
    description: 'Play 500 games',
    icon: '⚡',
    category: 'games',
    tier: 'diamond',
    requirement: { type: 'count', value: 500, metric: 'gamesPlayed' },
    points: 250,
    secret: true,
  },

  // Wins achievements
  {
    id: 'first_win',
    name: 'Winner',
    description: 'Win your first game',
    icon: '🥇',
    category: 'games',
    tier: 'bronze',
    requirement: { type: 'count', value: 1, metric: 'gamesWon' },
    points: 15,
  },
  {
    id: 'champion_10',
    name: 'Champion',
    description: 'Win 10 games',
    icon: '🏅',
    category: 'games',
    tier: 'silver',
    requirement: { type: 'count', value: 10, metric: 'gamesWon' },
    points: 30,
  },
  {
    id: 'master_50',
    name: 'Master',
    description: 'Win 50 games',
    icon: '🎖️',
    category: 'games',
    tier: 'gold',
    requirement: { type: 'count', value: 50, metric: 'gamesWon' },
    points: 75,
  },
  {
    id: 'grandmaster_100',
    name: 'Grandmaster',
    description: 'Win 100 games',
    icon: '🌟',
    category: 'games',
    tier: 'platinum',
    requirement: { type: 'count', value: 100, metric: 'gamesWon' },
    points: 150,
  },

  // Streak achievements
  {
    id: 'streak_3',
    name: 'On Fire',
    description: 'Win 3 games in a row',
    icon: '🔥',
    category: 'games',
    tier: 'silver',
    requirement: { type: 'streak', value: 3, metric: 'currentStreak' },
    points: 30,
  },
  {
    id: 'streak_5',
    name: 'Unstoppable',
    description: 'Win 5 games in a row',
    icon: '🔥🔥',
    category: 'games',
    tier: 'gold',
    requirement: { type: 'streak', value: 5, metric: 'currentStreak' },
    points: 50,
  },
  {
    id: 'streak_10',
    name: 'Godlike',
    description: 'Win 10 games in a row',
    icon: '🔥🔥🔥',
    category: 'games',
    tier: 'platinum',
    requirement: { type: 'streak', value: 10, metric: 'currentStreak' },
    points: 100,
    secret: true,
  },

  // Score achievements
  {
    id: 'scorer_1000',
    name: 'Scorer',
    description: 'Earn 1,000 total points',
    icon: '💯',
    category: 'games',
    tier: 'bronze',
    requirement: { type: 'score', value: 1000, metric: 'totalScore' },
    points: 20,
  },
  {
    id: 'scorer_10000',
    name: 'Point Collector',
    description: 'Earn 10,000 total points',
    icon: '💰',
    category: 'games',
    tier: 'silver',
    requirement: { type: 'score', value: 10000, metric: 'totalScore' },
    points: 40,
  },
  {
    id: 'scorer_100000',
    name: 'Point Millionaire',
    description: 'Earn 100,000 total points',
    icon: '💎',
    category: 'games',
    tier: 'gold',
    requirement: { type: 'score', value: 100000, metric: 'totalScore' },
    points: 80,
  },

  // Drawing achievements
  {
    id: 'artist_10',
    name: 'Artist',
    description: 'Draw 10 words',
    icon: '🎨',
    category: 'drawing',
    tier: 'bronze',
    requirement: { type: 'count', value: 10, metric: 'wordsDrawn' },
    points: 15,
  },
  {
    id: 'artist_50',
    name: 'Illustrator',
    description: 'Draw 50 words',
    icon: '🖼️',
    category: 'drawing',
    tier: 'silver',
    requirement: { type: 'count', value: 50, metric: 'wordsDrawn' },
    points: 35,
  },
  {
    id: 'artist_200',
    name: 'Picasso',
    description: 'Draw 200 words',
    icon: '🖌️',
    category: 'drawing',
    tier: 'gold',
    requirement: { type: 'count', value: 200, metric: 'wordsDrawn' },
    points: 75,
  },

  // Guessing achievements
  {
    id: 'guesser_10',
    name: 'Guesser',
    description: 'Guess 10 words correctly',
    icon: '🔍',
    category: 'guessing',
    tier: 'bronze',
    requirement: { type: 'count', value: 10, metric: 'wordsGuessed' },
    points: 15,
  },
  {
    id: 'guesser_50',
    name: 'Detective',
    description: 'Guess 50 words correctly',
    icon: '🕵️',
    category: 'guessing',
    tier: 'silver',
    requirement: { type: 'count', value: 50, metric: 'wordsGuessed' },
    points: 35,
  },
  {
    id: 'guesser_200',
    name: 'Psychic',
    description: 'Guess 200 words correctly',
    icon: '🔮',
    category: 'guessing',
    tier: 'gold',
    requirement: { type: 'count', value: 200, metric: 'wordsGuessed' },
    points: 75,
  },

  // Speed achievements
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Guess correctly within 5 seconds',
    icon: '⚡',
    category: 'guessing',
    tier: 'silver',
    requirement: { type: 'special', value: 1, metric: 'fastGuess' },
    points: 25,
  },
  {
    id: 'lightning',
    name: 'Lightning',
    description: 'Guess correctly within 3 seconds',
    icon: '⚡⚡',
    category: 'guessing',
    tier: 'gold',
    requirement: { type: 'special', value: 1, metric: 'ultraFastGuess' },
    points: 40,
    secret: true,
  },

  // Special achievements
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Be the first to guess correctly',
    icon: '🩸',
    category: 'special',
    tier: 'bronze',
    requirement: { type: 'count', value: 1, metric: 'firstGuesses' },
    points: 20,
  },
  {
    id: 'perfect_game',
    name: 'Perfect Game',
    description: 'Guess every word correctly in a game',
    icon: '💯',
    category: 'special',
    tier: 'gold',
    requirement: { type: 'count', value: 1, metric: 'perfectGames' },
    points: 50,
    secret: true,
  },
  {
    id: 'comeback',
    name: 'Comeback Kid',
    description: 'Win after being in last place',
    icon: '🚀',
    category: 'special',
    tier: 'silver',
    requirement: { type: 'count', value: 1, metric: 'comebackWins' },
    points: 30,
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Play with 20 different players',
    icon: '🦋',
    category: 'social',
    tier: 'silver',
    requirement: { type: 'count', value: 20, metric: 'uniquePlayers' },
    points: 25,
  },
  {
    id: 'popular',
    name: 'Popular',
    description: 'Be friended by 10 players',
    icon: '❤️',
    category: 'social',
    tier: 'gold',
    requirement: { type: 'count', value: 10, metric: 'friendCount' },
    points: 40,
  },

  // Play time achievements
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Play for 1 hour total',
    icon: '⏰',
    category: 'games',
    tier: 'bronze',
    requirement: { type: 'count', value: 60, metric: 'totalPlayTime' },
    points: 15,
  },
  {
    id: 'committed',
    name: 'Committed',
    description: 'Play for 10 hours total',
    icon: '⏱️',
    category: 'games',
    tier: 'silver',
    requirement: { type: 'count', value: 600, metric: 'totalPlayTime' },
    points: 35,
  },
  {
    id: 'obsessed',
    name: 'Obsessed',
    description: 'Play for 100 hours total',
    icon: '🕐',
    category: 'games',
    tier: 'gold',
    requirement: { type: 'count', value: 6000, metric: 'totalPlayTime' },
    points: 75,
    secret: true,
  },
];

// Tier colors for UI
export const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
};

// Tier multipliers for XP
export const TIER_MULTIPLIERS = {
  bronze: 1,
  silver: 1.5,
  gold: 2,
  platinum: 3,
  diamond: 5,
};

/**
 * Get all achievements
 */
export function getAllAchievements(): Achievement[] {
  return ACHIEVEMENTS;
}

/**
 * Get achievement by ID
 */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

/**
 * Get user's unlocked achievements
 */
export async function getUserAchievements(userId: string): Promise<AchievementUnlock[]> {
  const cached = await redis.getUserAchievements(userId);
  if (cached) {
    return cached.unlocked || [];
  }

  // If not in cache, return empty (will be populated on first check)
  return [];
}

/**
 * Check and unlock achievements for a user
 */
export async function checkAchievements(
  userId: string,
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalScore: number;
    totalPlayTime: number;
    currentStreak: number;
    bestStreak: number;
    wordsDrawn: number;
    wordsGuessed: number;
    firstGuesses: number;
    perfectGames: number;
    comebackWins: number;
    uniquePlayers: number;
    friendCount: number;
    fastGuess?: boolean;
    ultraFastGuess?: boolean;
  }
): Promise<AchievementUnlock[]> {
  const unlocked: AchievementUnlock[] = [];
  
  // Get currently unlocked achievements
  const currentAchievements = await getUserAchievements(userId);
  const unlockedIds = new Set(currentAchievements.map(a => a.achievementId));

  // Check each achievement
  for (const achievement of ACHIEVEMENTS) {
    // Skip if already unlocked
    if (unlockedIds.has(achievement.id)) {
      continue;
    }

    // Check if requirement is met
    const met = checkRequirement(achievement.requirement, stats);
    
    if (met) {
      // Unlock achievement
      const unlock: AchievementUnlock = {
        achievementId: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        points: achievement.points,
        unlockedAt: Date.now(),
      };

      unlocked.push(unlock);
      unlockedIds.add(achievement.id);

      logger.info('ACHIEVEMENT', `Achievement unlocked: ${achievement.name}`, {
        userId,
        achievementId: achievement.id,
        tier: achievement.tier,
      });
    }
  }

  // Save updated achievements if any were unlocked
  if (unlocked.length > 0) {
    const allAchievements = [...currentAchievements, ...unlocked];
    await redis.setUserAchievements(userId, {
      unlocked: allAchievements,
      totalPoints: allAchievements.reduce((sum, a) => sum + a.points, 0),
      lastChecked: Date.now(),
    });

    // Update user stats with achievement points
    await updatePlayerStats(userId, {
      achievementPoints: allAchievements.reduce((sum, a) => sum + a.points, 0),
    });
  }

  return unlocked;
}

/**
 * Check if a requirement is met
 */
function checkRequirement(
  requirement: Achievement['requirement'],
  stats: any
): boolean {
  const value = stats[requirement.metric] || 0;

  switch (requirement.type) {
    case 'count':
      return value >= requirement.value;
    case 'streak':
      return value >= requirement.value;
    case 'score':
      return value >= requirement.value;
    case 'special':
      return value >= requirement.value;
    default:
      return false;
  }
}

/**
 * Track special achievement metrics during gameplay
 */
export async function trackGameMetrics(
  userId: string,
  metrics: {
    guessTime?: number; // Time to guess in seconds
    wasFirst?: boolean; // Was first to guess
    wasLastPlace?: boolean; // Was in last place before winning
    allGuessedCorrectly?: boolean; // Guessed all words in game
    uniquePlayers?: string[]; // New unique players met
  }
): Promise<void> {
  const currentStats = await getPlayerStats(userId);
  
  const updates: any = {};

  // Fast guess tracking
  if (metrics.guessTime !== undefined) {
    if (metrics.guessTime <= 3) {
      updates.ultraFastGuess = (currentStats.ultraFastGuess || 0) + 1;
    } else if (metrics.guessTime <= 5) {
      updates.fastGuess = (currentStats.fastGuess || 0) + 1;
    }
  }

  // First guess tracking
  if (metrics.wasFirst) {
    updates.firstGuesses = (currentStats.firstGuesses || 0) + 1;
  }

  // Comeback tracking
  if (metrics.wasLastPlace) {
    updates.comebackWins = (currentStats.comebackWins || 0) + 1;
  }

  // Perfect game tracking
  if (metrics.allGuessedCorrectly) {
    updates.perfectGames = (currentStats.perfectGames || 0) + 1;
  }

  // Unique players tracking
  if (metrics.uniquePlayers && metrics.uniquePlayers.length > 0) {
    const currentUnique = new Set(currentStats.uniquePlayersMet || []);
    let newPlayers = 0;
    
    for (const playerId of metrics.uniquePlayers) {
      if (!currentUnique.has(playerId)) {
        currentUnique.add(playerId);
        newPlayers++;
      }
    }
    
    if (newPlayers > 0) {
      updates.uniquePlayers = currentUnique.size;
      updates.uniquePlayersMet = Array.from(currentUnique);
    }
  }

  // Apply updates if any
  if (Object.keys(updates).length > 0) {
    await updatePlayerStats(userId, updates);
  }
}

/**
 * Calculate total achievement progress
 */
export async function getAchievementProgress(userId: string): Promise<{
  total: number;
  unlocked: number;
  points: number;
  percentage: number;
  byCategory: Record<string, { total: number; unlocked: number }>;
  byTier: Record<string, { total: number; unlocked: number }>;
}> {
  const achievements = await getUserAchievements(userId);
  const unlockedIds = new Set(achievements.map(a => a.achievementId));
  const totalPoints = achievements.reduce((sum, a) => sum + a.points, 0);

  const byCategory: Record<string, { total: number; unlocked: number }> = {};
  const byTier: Record<string, { total: number; unlocked: number }> = {};

  // Initialize categories and tiers
  const categories = ['games', 'drawing', 'guessing', 'social', 'special'] as const;
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

  for (const cat of categories) {
    byCategory[cat] = { total: 0, unlocked: 0 };
  }

  for (const tier of tiers) {
    byTier[tier] = { total: 0, unlocked: 0 };
  }

  // Count achievements
  for (const achievement of ACHIEVEMENTS) {
    byCategory[achievement.category].total++;
    byTier[achievement.tier].total++;

    if (unlockedIds.has(achievement.id)) {
      byCategory[achievement.category].unlocked++;
      byTier[achievement.tier].unlocked++;
    }
  }

  return {
    total: ACHIEVEMENTS.length,
    unlocked: achievements.length,
    points: totalPoints,
    percentage: Math.round((achievements.length / ACHIEVEMENTS.length) * 100),
    byCategory,
    byTier,
  };
}

/**
 * Get next achievements to unlock (closest to completion)
 */
export async function getNextAchievements(
  userId: string,
  stats: any,
  limit: number = 5
): Promise<Array<Achievement & { progress: number; needed: number }>> {
  const achievements = await getUserAchievements(userId);
  const unlockedIds = new Set(achievements.map(a => a.achievementId));

  const nextAchievements: Array<Achievement & { progress: number; needed: number }> = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;

    const current = stats[achievement.requirement.metric] || 0;
    const needed = achievement.requirement.value;
    const progress = Math.min(100, Math.round((current / needed) * 100));

    nextAchievements.push({
      ...achievement,
      progress,
      needed: Math.max(0, needed - current),
    });
  }

  // Sort by progress (highest first) and return top N
  return nextAchievements
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit);
}

// Export achievement system
export default {
  ACHIEVEMENTS,
  TIER_COLORS,
  TIER_MULTIPLIERS,
  getAllAchievements,
  getAchievement,
  getAchievementsByCategory,
  getUserAchievements,
  checkAchievements,
  trackGameMetrics,
  getAchievementProgress,
  getNextAchievements,
};

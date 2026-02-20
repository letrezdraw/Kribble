// Local type definitions
export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legend' | 'professional' | 'goat';

export interface RankInfo {
  tier: RankTier;
  name: string;
  icon: string;
  color: string;
  minLevel: number;
  maxLevel: number;
}


export const RANKS: RankInfo[] = [
  {
    tier: 'bronze',
    name: 'Bronze',
    icon: '🥉',
    color: '#CD7F32',
    minLevel: 1,
    maxLevel: 10
  },
  {
    tier: 'silver',
    name: 'Silver',
    icon: '🥈',
    color: '#C0C0C0',
    minLevel: 11,
    maxLevel: 25
  },
  {
    tier: 'gold',
    name: 'Gold',
    icon: '🥇',
    color: '#FFD700',
    minLevel: 26,
    maxLevel: 50
  },
  {
    tier: 'platinum',
    name: 'Platinum',
    icon: '💎',
    color: '#00CED1',
    minLevel: 51,
    maxLevel: 100
  },
  {
    tier: 'legend',
    name: 'Legend',
    icon: '🔥',
    color: '#FF4500',
    minLevel: 101,
    maxLevel: 200
  },
  {
    tier: 'professional',
    name: 'Professional',
    icon: '🏆',
    color: '#9370DB',
    minLevel: 201,
    maxLevel: 500
  },
  {
    tier: 'goat',
    name: 'G.O.A.T.',
    icon: '👑',
    color: '#FFD700',
    minLevel: 501,
    maxLevel: 9999
  }
];

export function getRankByLevel(level: number): RankInfo {
  return RANKS.find(rank => level >= rank.minLevel && level <= rank.maxLevel) || RANKS[0];
}

export function getRankByTier(tier: RankTier): RankInfo {
  return RANKS.find(rank => rank.tier === tier) || RANKS[0];
}

export function getNextRank(level: number): RankInfo | null {
  const currentRank = getRankByLevel(level);
  const currentIndex = RANKS.findIndex(r => r.tier === currentRank.tier);
  return RANKS[currentIndex + 1] || null;
}

export function getRankProgress(level: number, xp: number): { current: number; max: number; percentage: number } {
  const currentRank = getRankByLevel(level);
  const nextRank = getNextRank(level);
  
  if (!nextRank) {
    return { current: xp, max: xp, percentage: 100 };
  }
  
  const levelsInCurrentRank = currentRank.maxLevel - currentRank.minLevel + 1;
  const xpPerLevel = 500;
  const xpInRank = (level - currentRank.minLevel) * xpPerLevel + (xp % xpPerLevel);
  const xpNeededForRank = levelsInCurrentRank * xpPerLevel;
  
  return {
    current: xpInRank,
    max: xpNeededForRank,
    percentage: Math.min(100, (xpInRank / xpNeededForRank) * 100)
  };
}

export function calculateXPForNextLevel(level: number): number {
  return level * 500;
}

export function formatPlayTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } else {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}

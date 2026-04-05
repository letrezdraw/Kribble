/** Kribble 1.0 rank tiers — copied for lobby UI parity. */
export type RankTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'legend'
  | 'professional'
  | 'goat';

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
    maxLevel: 10,
  },
  {
    tier: 'silver',
    name: 'Silver',
    icon: '🥈',
    color: '#C0C0C0',
    minLevel: 11,
    maxLevel: 25,
  },
  {
    tier: 'gold',
    name: 'Gold',
    icon: '🥇',
    color: '#FFD700',
    minLevel: 26,
    maxLevel: 50,
  },
  {
    tier: 'platinum',
    name: 'Platinum',
    icon: '💎',
    color: '#00CED1',
    minLevel: 51,
    maxLevel: 100,
  },
  {
    tier: 'legend',
    name: 'Legend',
    icon: '🔥',
    color: '#FF4500',
    minLevel: 101,
    maxLevel: 200,
  },
  {
    tier: 'professional',
    name: 'Professional',
    icon: '🏆',
    color: '#9370DB',
    minLevel: 201,
    maxLevel: 500,
  },
  {
    tier: 'goat',
    name: 'G.O.A.T.',
    icon: '👑',
    color: '#FFD700',
    minLevel: 501,
    maxLevel: 9999,
  },
];

export function getRankByLevel(level: number): RankInfo {
  return (
    RANKS.find((rank) => level >= rank.minLevel && level <= rank.maxLevel) ||
    RANKS[0]
  );
}

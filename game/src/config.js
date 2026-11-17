// Lantern Keeper — every tuning number and colour in one place.
// The world, renderer and audio all read from here, so balancing the game
// never means hunting through logic code.

/** Design resolution: the canvas is always 960x540 inside, CSS scales it. */
export const VIEW = { width: 960, height: 540 };

/** Fixed simulation step (seconds): the world advances in 1/60 s ticks. */
export const STEP = 1 / 60;

/** localStorage key for the best score. */
export const BEST_KEY = 'lantern-keeper-best';

/** The seawall the keeper walks on, and the waterline in front of it. */
export const WALL = {
  top: 470, // y of the wall's walking surface (the keeper's feet rest here)
  waterY: 514, // y where falling things splash into the sea
  playMinX: 8, // the keeper and falling things stay left of the lighthouse
  playMaxX: 812,
};

/** The lighthouse stands at the right end of the wall. */
export const LIGHTHOUSE = {
  baseX: 848,
  baseWidth: 80,
  topY: 158, // y of the lamp room's floor
  lampX: 888,
  lampY: 176,
  lampRadius: 15,
};

export const PLAYER = {
  width: 44,
  height: 56,
  speed: 430, // px per second, left/right
  startLives: 3,
  maxLives: 5,
  invincibleSeconds: 1.5, // grace period (with blinking) after a hit
  reachUp: 12, // the raised lantern catches a little above the keeper's head
};

export const FIREFLY = {
  radius: 9,
  score: 10,
  energy: 2, // percent of lighthouse charge per catch
  baseFall: 128, // px per second at level 1
  fallPerLevel: 16,
  fallJitter: 30,
};

export const SUNSTONE = {
  radius: 12,
  score: 50,
  energy: 6,
  lives: 1, // also restores a life (up to PLAYER.maxLives)
  baseFall: 108,
  minGap: 11, // seconds between sunstones, randomised up to maxGap
  maxGap: 17,
};

export const SHADOW_BLOCK = {
  width: 36,
  height: 28,
  baseFall: 162,
  fallPerLevel: 24,
  fallJitter: 40,
  driftFromLevel: 5, // from this level, blocks also slide sideways
  driftMin: 25,
  driftMax: 70,
};

export const LEVELS = {
  secondsPerLevel: 15,
  maxLevel: 8,
  pairFromLevel: 7, // from here, a firefly sometimes falls paired with a block
  pairChance: 0.35,
  pairOffset: 72, // px between the paired firefly and block
};

/** Spawn pacing per level; both intervals shrink as levels rise. */
export function fireflyInterval(level) {
  return Math.max(0.5, 1.0 - (level - 1) * 0.07);
}
export function blockInterval(level) {
  return Math.max(0.75, 1.55 - (level - 1) * 0.12);
}

/** Combo: consecutive catches build a streak; these streaks raise the multiplier. */
export const COMBO = {
  tierTwoAt: 5, // streak for x2
  tierThreeAt: 10, // streak for x3
  maxMultiplier: 3,
};

export function comboMultiplier(streak) {
  if (streak >= COMBO.tierThreeAt) return 3;
  if (streak >= COMBO.tierTwoAt) return 2;
  return 1;
}

/** Charge needed to light the lighthouse and win. */
export const ENERGY_TO_WIN = 100;

/** Particle burst sizes for the three kinds of feedback. */
export const PARTICLES = {
  catchBurst: 10,
  sunstoneBurst: 18,
  hurtBurst: 14,
  splash: 6,
  maxAlive: 240,
};

/** Fixed palette: deep-teal night sea against warm amber lamplight. */
export const COLORS = {
  skyTop: '#06222e',
  skyHorizon: '#0d3a49',
  sea: '#082f3c',
  seaWave: '#175d6e',
  wallStone: '#2b3d45',
  wallEdge: '#4a6672',
  wallDark: '#1d2c33',
  amber: '#ffb340',
  amberSoft: '#ffd98a',
  firefly: '#ffcf6e',
  sunstone: '#ffe066',
  sunstoneCore: '#fff7d6',
  blockBody: '#141126',
  blockEdge: '#57448f',
  blockGlow: '#8b5cf6',
  keeperCloak: '#274b5c',
  keeperTrim: '#ffb340',
  keeperSkin: '#f2c99a',
  textWarm: '#f7ecd4',
  textDim: '#a7c0c4',
  panel: 'rgba(4, 24, 32, 0.82)',
  hudBand: 'rgba(3, 18, 24, 0.55)',
  hurt: '#ff7a6b',
  splash: '#bfe8ef',
};

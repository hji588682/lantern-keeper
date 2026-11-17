// Lantern Keeper — the world: game state and rules, with no drawing and no DOM.
// main.js advances it in fixed steps; render.js only reads the state;
// shots.js drives it with an autopilot to stage screenshots.
import {
  ENERGY_TO_WIN,
  FIREFLY,
  LEVELS,
  LIGHTHOUSE,
  PARTICLES,
  PLAYER,
  SHADOW_BLOCK,
  SUNSTONE,
  WALL,
  blockInterval,
  comboMultiplier,
  fireflyInterval,
} from './config.js';
import { randomChance, randomRange, randomSign } from './random.js';

export const KIND_FIREFLY = 'firefly';
export const KIND_SUNSTONE = 'sunstone';
export const KIND_BLOCK = 'block';

/** Event bits returned by step(), so main.js can play sounds and announcements. */
export const EVENT_CATCH = 1;
export const EVENT_SUNSTONE = 2;
export const EVENT_HURT = 4;
export const EVENT_LEVEL_UP = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;

const PARTICLE_GRAVITY = 260;

function makeItem(kind, x, y) {
  return { kind, x, y, width: 0, height: 0, fall: 0, vx: 0, seed: 0, dead: false };
}

/**
 * Create a world driven by the given random generator.
 * step(dt, move, attract): move is -1, 0 or 1; attract mode (title screen)
 * lets things fall for show, with no player, collisions or scoring.
 */
export function createWorld(nextRandom) {
  const state = {
    time: 0, // seconds of play this run (drives levels, invincibility, banners)
    visualTime: 0, // always advances; render animates waves and glows from it
    level: 1,
    score: 0,
    energy: 0,
    lives: PLAYER.startLives,
    comboStreak: 0,
    bestStreak: 0,
    player: { x: 0, y: WALL.top - PLAYER.height, width: PLAYER.width, height: PLAYER.height },
    items: [],
    particles: [],
    invincibleUntil: -1,
    bannerText: '',
    bannerUntil: -1,
    shake: 0,
    won: false,
    over: false,
    fireflyTimer: 0,
    blockTimer: 0,
    sunstoneTimer: 0,
  };

  function centrePlayer() {
    state.player.x = (WALL.playMinX + WALL.playMaxX) / 2 - PLAYER.width / 2;
  }

  function reset() {
    state.time = 0;
    state.level = 1;
    state.score = 0;
    state.energy = 0;
    state.lives = PLAYER.startLives;
    state.comboStreak = 0;
    state.bestStreak = 0;
    state.items.length = 0;
    state.particles.length = 0;
    state.invincibleUntil = -1;
    state.bannerText = '';
    state.bannerUntil = -1;
    state.shake = 0;
    state.won = false;
    state.over = false;
    state.fireflyTimer = 0.35;
    state.blockTimer = 1.3;
    state.sunstoneTimer = randomRange(nextRandom, SUNSTONE.minGap, SUNSTONE.maxGap);
    centrePlayer();
  }

  function spawnFirefly(x) {
    const item = makeItem(
      KIND_FIREFLY,
      x ?? randomRange(nextRandom, WALL.playMinX + 20, WALL.playMaxX - 20),
      -24,
    );
    item.width = FIREFLY.radius * 2;
    item.height = FIREFLY.radius * 2;
    item.fall = FIREFLY.baseFall + (state.level - 1) * FIREFLY.fallPerLevel + nextRandom() * FIREFLY.fallJitter;
    item.seed = nextRandom();
    state.items.push(item);
    return item;
  }

  function spawnBlock(x) {
    const item = makeItem(
      KIND_BLOCK,
      x ?? randomRange(nextRandom, WALL.playMinX + 10, WALL.playMaxX - 10 - SHADOW_BLOCK.width),
      -36,
    );
    item.width = SHADOW_BLOCK.width;
    item.height = SHADOW_BLOCK.height;
    item.fall =
      SHADOW_BLOCK.baseFall + (state.level - 1) * SHADOW_BLOCK.fallPerLevel + nextRandom() * SHADOW_BLOCK.fallJitter;
    if (state.level >= SHADOW_BLOCK.driftFromLevel) {
      item.vx = randomSign(nextRandom) * randomRange(nextRandom, SHADOW_BLOCK.driftMin, SHADOW_BLOCK.driftMax);
    }
    item.seed = nextRandom();
    state.items.push(item);
    return item;
  }

  function spawnSunstone() {
    const item = makeItem(KIND_SUNSTONE, randomRange(nextRandom, WALL.playMinX + 24, WALL.playMaxX - 24), -26);
    item.width = SUNSTONE.radius * 2;
    item.height = SUNSTONE.radius * 2;
    item.fall = SUNSTONE.baseFall;
    item.seed = nextRandom();
    state.items.push(item);
    return item;
  }

  function burst(x, y, count, color, speed) {
    for (let i = 0; i < count && state.particles.length < PARTICLES.maxAlive; i += 1) {
      const angle = nextRandom() * Math.PI * 2;
      const velocity = speed * (0.35 + nextRandom() * 0.85);
      const life = randomRange(nextRandom, 0.35, 0.8);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 40,
        life,
        maxLife: life,
        size: randomRange(nextRandom, 1.6, 3.4),
        color,
      });
    }
  }

  function splash(x) {
    for (let i = 0; i < PARTICLES.splash && state.particles.length < PARTICLES.maxAlive; i += 1) {
      const life = randomRange(nextRandom, 0.25, 0.5);
      state.particles.push({
        x: x + randomRange(nextRandom, -8, 8),
        y: WALL.waterY,
        vx: randomRange(nextRandom, -26, 26),
        vy: randomRange(nextRandom, -120, -50),
        life,
        maxLife: life,
        size: randomRange(nextRandom, 1.4, 2.8),
        color: '#bfe8ef',
      });
    }
  }

  function runSpawners(dt, attract) {
    state.fireflyTimer -= dt;
    if (state.fireflyTimer <= 0) {
      state.fireflyTimer = fireflyInterval(state.level) * randomRange(nextRandom, 0.75, 1.25);
      const firefly = spawnFirefly();
      // Late game: a firefly sometimes falls beside a shadow block — pick one.
      if (!attract && state.level >= LEVELS.pairFromLevel && randomChance(nextRandom, LEVELS.pairChance)) {
        const side = randomSign(nextRandom);
        const blockX = Math.min(
          WALL.playMaxX - SHADOW_BLOCK.width,
          Math.max(WALL.playMinX, firefly.x + side * LEVELS.pairOffset),
        );
        spawnBlock(blockX);
      }
    }
    state.blockTimer -= dt;
    if (state.blockTimer <= 0) {
      state.blockTimer = blockInterval(state.level) * randomRange(nextRandom, 0.8, 1.2);
      spawnBlock();
    }
    if (!attract) {
      state.sunstoneTimer -= dt;
      if (state.sunstoneTimer <= 0) {
        state.sunstoneTimer = randomRange(nextRandom, SUNSTONE.minGap, SUNSTONE.maxGap);
        spawnSunstone();
      }
    }
  }

  function moveItems(dt) {
    for (const item of state.items) {
      item.y += item.fall * dt;
      if (item.vx !== 0) {
        item.x += item.vx * dt;
        if (item.x < WALL.playMinX) {
          item.x = WALL.playMinX;
          item.vx = Math.abs(item.vx);
        } else if (item.x + item.width > WALL.playMaxX) {
          item.x = WALL.playMaxX - item.width;
          item.vx = -Math.abs(item.vx);
        }
      }
    }
  }

  function overlapsCatchZone(item) {
    const p = state.player;
    const zoneTop = p.y - PLAYER.reachUp;
    return (
      item.x < p.x + p.width && item.x + item.width > p.x && item.y < p.y + p.height && item.y + item.height > zoneTop
    );
  }

  function resolveCatches(attract) {
    let events = 0;
    for (const item of state.items) {
      if (item.y - item.height > WALL.waterY) {
        item.dead = true;
        splash(item.x + item.width / 2);
        if (!attract && item.kind === KIND_FIREFLY) state.comboStreak = 0; // a missed firefly breaks the streak
        continue;
      }
      if (attract || !overlapsCatchZone(item)) continue;
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      if (item.kind === KIND_FIREFLY) {
        item.dead = true;
        state.comboStreak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.comboStreak);
        state.score += FIREFLY.score * comboMultiplier(state.comboStreak);
        state.energy = Math.min(ENERGY_TO_WIN, state.energy + FIREFLY.energy);
        burst(cx, cy, PARTICLES.catchBurst, '#ffcf6e', 130);
        events |= EVENT_CATCH;
      } else if (item.kind === KIND_SUNSTONE) {
        item.dead = true;
        state.score += SUNSTONE.score;
        state.energy = Math.min(ENERGY_TO_WIN, state.energy + SUNSTONE.energy);
        state.lives = Math.min(PLAYER.maxLives, state.lives + SUNSTONE.lives);
        burst(cx, cy, PARTICLES.sunstoneBurst, '#ffe066', 190);
        events |= EVENT_SUNSTONE;
      } else if (item.kind === KIND_BLOCK && state.time >= state.invincibleUntil) {
        item.dead = true;
        state.lives -= 1;
        state.comboStreak = 0;
        state.invincibleUntil = state.time + PLAYER.invincibleSeconds;
        state.shake = 0.35;
        burst(cx, cy, PARTICLES.hurtBurst, '#ff7a6b', 170);
        events |= EVENT_HURT;
        if (state.lives <= 0) {
          state.over = true;
          events |= EVENT_OVER;
        }
      }
    }
    state.items = state.items.filter((item) => !item.dead);
    return events;
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += PARTICLE_GRAVITY * dt;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function checkLevelAndWin() {
    let events = 0;
    const newLevel = Math.min(LEVELS.maxLevel, Math.floor(state.time / LEVELS.secondsPerLevel) + 1);
    if (newLevel > state.level) {
      state.level = newLevel;
      state.bannerText = `Level ${newLevel}`;
      state.bannerUntil = state.time + 1.6;
      events |= EVENT_LEVEL_UP;
    }
    if (!state.won && state.energy >= ENERGY_TO_WIN) {
      state.won = true;
      burst(LIGHTHOUSE.lampX, LIGHTHOUSE.lampY, 30, '#ffd98a', 240);
      events |= EVENT_WIN;
    }
    return events;
  }

  function step(dt, move, attract) {
    state.visualTime += dt;
    updateParticles(dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.won || state.over) return 0;
    if (!attract) {
      state.time += dt;
      const p = state.player;
      p.x += move * PLAYER.speed * dt;
      p.x = Math.min(WALL.playMaxX - p.width, Math.max(WALL.playMinX, p.x));
    }
    runSpawners(dt, attract);
    moveItems(dt);
    let events = resolveCatches(attract);
    if (!attract) events |= checkLevelAndWin();
    return events;
  }

  reset();
  return { state, reset, step };
}

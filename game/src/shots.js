// Lantern Keeper — screenshot scenes behind ?shot=start|play|win|over|end.
// Each scene plays the real rules forward from a seeded world, steered by an
// autopilot, so the frame is what an actual game looks like and the same
// seed always stages the same frame. "end" is accepted as an alias of "over".
import { PLAYER, STEP, WALL } from './config.js';
import { createRandom } from './random.js';
import { KIND_BLOCK, KIND_FIREFLY, KIND_SUNSTONE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_ATTRACT_SECONDS = 4;
const START_DEMO_SECONDS = 30;
const PLAY_SECONDS = 16;
const PLAY_FALLBACK_SECONDS = 10;
/** The play scene hunts for a rich mid-game frame instead of a fixed time:
 *  it steps the skilled pilot and accepts the first frame whose charge,
 *  crowd, blocks and combo all clear these bars, searching at most
 *  PLAY_SEARCH_SECONDS a try and PLAY_ATTEMPTS tries before falling back
 *  to the fixed run above. */
const PLAY_SEARCH_SECONDS = 90;
const PLAY_ATTEMPTS = 3;
const PLAY_MIN_ENERGY = 45;
const PLAY_MAX_ENERGY = 72;
const PLAY_MIN_ITEMS = 5;
const PLAY_MIN_BLOCKS = 2;
const PLAY_MIN_STREAK = 3;
const WIN_LIMIT_SECONDS = 300;
const OVER_LIMIT_SECONDS = 600;
const MAX_ATTEMPTS = 12;

/** How far ahead the pilot checks for blocks: the win pilot looks far and
 *  survives. The game-over pilot does not dodge at all — it just chases
 *  fireflies, hesitates, and is caught the way a careless player is. */
const LOOKAHEAD_SKILLED = 0.8;
/** Share of steps the game-over pilot spends frozen instead of moving. */
const HESITATION = 0.3;
const SAMPLE = 1 / 30;
/** Breathing room the pilot keeps between the keeper and a falling block. */
const MARGIN = 5;

/** Earliest time (seconds) moving in `direction` collides with a block, or Infinity. */
function earliestBlockHit(state, direction, horizon) {
  const player = state.player;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const moved = player.x + direction * PLAYER.speed * t;
    const x = Math.min(WALL.playMaxX - player.width, Math.max(WALL.playMinX, moved));
    for (const item of state.items) {
      if (item.kind !== KIND_BLOCK) continue;
      const itemX = item.x + item.vx * t;
      const itemY = item.y + item.fall * t;
      const overlapsX = itemX < x + player.width + MARGIN && itemX + item.width > x - MARGIN;
      const overlapsY = itemY + item.height > player.y && itemY < player.y + player.height;
      if (overlapsX && overlapsY) return t;
    }
  }
  return Infinity;
}

/**
 * The pilot's move: head for the lowest falling prize (firefly or sunstone),
 * but pick the first of [toward it, stay, away] that no block reaches in
 * time; if every way is hit, take the one that is hit last.
 */
function autopilotMove(state, horizon) {
  const player = state.player;
  const centre = player.x + player.width / 2;
  let target = (WALL.playMinX + WALL.playMaxX) / 2;
  let lowestY = -Infinity;
  for (const item of state.items) {
    if (item.kind !== KIND_FIREFLY && item.kind !== KIND_SUNSTONE) continue;
    if (item.y > lowestY) {
      lowestY = item.y;
      target = item.x + item.width / 2;
    }
  }
  const toward = target > centre + 6 ? 1 : target < centre - 6 ? -1 : 0;
  const candidates = [];
  for (const dir of [toward, 0, -toward]) {
    if (!candidates.includes(dir)) candidates.push(dir);
  }
  let bestDir = candidates[0];
  let bestTime = -1;
  for (const dir of candidates) {
    const hitAt = earliestBlockHit(state, dir, horizon);
    if (hitAt === Infinity) return dir;
    if (hitAt > bestTime) {
      bestTime = hitAt;
      bestDir = dir;
    }
  }
  return bestDir;
}

/** Step the world with a move function until `done(state)` or the time limit. */
function playWithPilot(world, moveFn, limitSeconds, done) {
  const maxSteps = Math.floor(limitSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    world.step(STEP, moveFn(world.state), false);
    if (done(world.state)) return true;
  }
  return done(world.state);
}

const skilledMove = (state) => autopilotMove(state, LOOKAHEAD_SKILLED);

/** A frame worth showing as gameplay: the charge is well under way but the
 *  game is far from won, the sky is busy, blocks are in it, and a combo is
 *  running. */
function isRichPlayFrame(state) {
  if (state.energy < PLAY_MIN_ENERGY || state.energy > PLAY_MAX_ENERGY) return false;
  if (state.items.length < PLAY_MIN_ITEMS) return false;
  if (state.comboStreak < PLAY_MIN_STREAK) return false;
  let blocks = 0;
  for (const item of state.items) {
    if (item.kind === KIND_BLOCK) blocks += 1;
  }
  return blocks >= PLAY_MIN_BLOCKS;
}

/**
 * Step the skilled pilot one tick at a time, checking after each step,
 * until a rich frame appears. Returns false when the run ends first or the
 * search budget runs out; the caller then resets and tries again (a reset
 * does not rewind the world's generator, so each attempt plays out
 * differently, while the staging as a whole stays fixed for a given seed).
 */
function playUntilRichFrame(world) {
  const maxSteps = Math.floor(PLAY_SEARCH_SECONDS / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    world.step(STEP, skilledMove(world.state), false);
    const state = world.state;
    if (state.won || state.over) return false;
    if (isRichPlayFrame(state)) return true;
  }
  return false;
}

/**
 * The game-over pilot for one attempt: a pure firefly chaser (no dodging)
 * that hesitates on a share of its steps. Its indecision comes from its own
 * fixed-seed generator, so staging stays reproducible.
 */
function carelessMove(attempt) {
  const hesitate = createRandom(0x5eed + attempt);
  return (state) => (hesitate() < HESITATION ? 0 : autopilotMove(state, 0));
}

/**
 * Stage the named scene in `world` and return the screen to draw and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    for (let attempt = 0; attempt < PLAY_ATTEMPTS; attempt += 1) {
      world.reset();
      if (playUntilRichFrame(world)) {
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
    }
    // No attempt framed a rich moment: stage the fixed run, as before.
    world.reset();
    playWithPilot(world, skilledMove, PLAY_SECONDS, (s) => s.won || s.over);
    if (world.state.won || world.state.over) {
      // Too eventful for a mid-game frame: restage a shorter, quieter run.
      world.reset();
      playWithPilot(world, skilledMove, PLAY_FALLBACK_SECONDS, (s) => s.won || s.over);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      world.reset();
      if (playWithPilot(world, skilledMove, WIN_LIMIT_SECONDS, (s) => s.won || s.over) && world.state.won) {
        return { screen: SCREEN_WIN, best: world.state.score };
      }
    }
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  if (name === 'over' || name === 'end') {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      world.reset();
      if (playWithPilot(world, carelessMove(attempt), OVER_LIMIT_SECONDS, (s) => s.won || s.over) && world.state.over) {
        return { screen: SCREEN_OVER, best: world.state.score };
      }
    }
    // Last resort: a keeper who never moves at all is eventually caught.
    world.reset();
    playWithPilot(world, () => 0, OVER_LIMIT_SECONDS, (s) => s.won || s.over);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // Title: first a short demo run so the title can show a real best score,
  // then a fresh world idling in attract mode behind the panel.
  world.reset();
  playWithPilot(world, skilledMove, START_DEMO_SECONDS, (s) => s.won || s.over);
  const best = world.state.score;
  world.reset();
  const attractSteps = Math.floor(START_ATTRACT_SECONDS / STEP);
  for (let i = 0; i < attractSteps; i += 1) world.step(STEP, 0, true);
  return { screen: SCREEN_TITLE, best };
}

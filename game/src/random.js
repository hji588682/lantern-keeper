// Lantern Keeper — seeded randomness.
// A mulberry32 generator: tiny, fast, and the same seed always produces the
// same stream, which is what makes the screenshot scenes reproducible.

/**
 * Create a random generator from a 32-bit seed.
 * Returns a function that yields floats in [0, 1), like Math.random.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function randomRange(nextRandom, min, max) {
  return min + nextRandom() * (max - min);
}

/** Random integer in [min, max], both ends included. */
export function randomInt(nextRandom, min, max) {
  return min + Math.floor(nextRandom() * (max - min + 1));
}

/** True with probability p (0..1). */
export function randomChance(nextRandom, p) {
  return nextRandom() < p;
}

/** Random sign: -1 or +1. */
export function randomSign(nextRandom) {
  return nextRandom() < 0.5 ? -1 : 1;
}

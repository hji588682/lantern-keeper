// Lantern Keeper — boot and the one game loop.
// Input is read every frame, the world advances in fixed 1/60 s steps, and
// the renderer paints the result. Screens: title, playing, paused, won, over.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|win|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice, then sets
// window.__shotReady so a screenshot can be taken.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CATCH, EVENT_HURT, EVENT_LEVEL_UP, EVENT_OVER, EVENT_SUNSTONE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be unavailable (private windows): best lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Charge the lighthouse to 100 percent. 3 lives.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      won
        ? `You lit the lighthouse. Score ${world.state.score}.`
        : `Game over. Score ${world.state.score}. Best ${best}.`,
    );
  }

  /** Turn one step's world events into sounds and announcements. */
  function reactToEvents(events) {
    if (events & EVENT_CATCH) audio.pickup(world.state.comboStreak);
    if (events & EVENT_SUNSTONE) audio.sunstone();
    if (events & EVENT_LEVEL_UP) audio.levelUp();
    if (events & EVENT_HURT) {
      audio.hurt();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startRun();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function stepOnce() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, true); // the title idles in attract mode
      return;
    }
    const centre = world.state.player.x + world.state.player.width / 2;
    const events = world.step(STEP, input.directionFor(centre), false);
    reactToEvents(events);
    if (events & EVENT_WIN) {
      audio.win();
      finishRun(true);
    } else if (events & EVENT_OVER) {
      audio.lose();
      finishRun(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepOnce();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game instead of dropping blocks unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lantern Keeper. Press Space or tap to start.');
  requestAnimationFrame(frame);
}

if (shotName) runShot(shotName);
else runGame();

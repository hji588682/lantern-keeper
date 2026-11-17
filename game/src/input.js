// Lantern Keeper — player input: keyboard, mouse and touch.
// Held keys and the pointer give a movement direction; discrete presses
// (start/confirm, pause, mute) are queued as action bits for main.js.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

/**
 * Create input bound to the canvas. Pointer steering: while the pointer is
 * held down, directionFor() steers toward its x position; a pointer press
 * also counts as CONFIRM, so taps start and restart the game.
 */
export function createInput(canvas) {
  const held = new Set();
  let pendingActions = 0;
  let pointerX = null; // design-space x while the pointer is down, else null

  function toDesignX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? ((clientX - rect.left) / rect.width) * canvas.width : 0;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (LEFT_KEYS.has(event.code) || RIGHT_KEYS.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (event.code === 'Space') {
      pendingActions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      pendingActions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      pendingActions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    pointerX = null;
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerX = toDesignX(event.clientX);
    pendingActions |= ACTION_CONFIRM;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerX !== null) pointerX = toDesignX(event.clientX);
  });
  const releasePointer = () => {
    pointerX = null;
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  return {
    /**
     * Movement for this frame: -1, 0 or 1. Held keys win; otherwise, if the
     * pointer is down, steer toward it (with a small dead zone so the
     * keeper settles instead of jittering).
     */
    directionFor(playerCentreX) {
      let dir = 0;
      for (const code of held) {
        if (LEFT_KEYS.has(code)) dir -= 1;
        if (RIGHT_KEYS.has(code)) dir += 1;
      }
      if (dir !== 0) return Math.sign(dir);
      if (pointerX !== null) {
        const gap = pointerX - playerCentreX;
        if (Math.abs(gap) > 10) return Math.sign(gap);
      }
      return 0;
    },
    /** Action bits pressed since the last call; calling clears the queue. */
    takeActions() {
      const actions = pendingActions;
      pendingActions = 0;
      return actions;
    },
  };
}

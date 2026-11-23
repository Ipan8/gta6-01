// Keyboard + pointer input. Held keys give a movement vector; one-shot presses
// (start, pause, enter car, jump, interact, reload) are queued as bit flags and
// taken once by the loop, so a press between frames is never lost or counted
// twice. Mouse drag orbits the camera; the wheel zooms.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_JUMP = 8;
export const ACTION_INTERACT = 16;
export const ACTION_RELOAD = 32;

const FWD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let dragging = false;
  let shooting = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FWD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code)
      || RIGHT.has(event.code) || SPRINT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE' && !event.repeat) {
      actions |= ACTION_ENTER;
    } else if (event.code === 'Space' && !event.repeat) {
      // Space is both confirm and jump; confirm is consumed on menus, jump in play.
      actions |= ACTION_JUMP;
    } else if (event.code === 'KeyF' && !event.repeat) {
      actions |= ACTION_INTERACT;
    } else if (event.code === 'KeyR' && !event.repeat) {
      actions |= ACTION_RELOAD;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup.
  window.addEventListener('blur', () => { held.clear(); dragging = false; shooting = false; });

  target.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      shooting = true;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    lookDX += event.clientX - lastX;
    lookDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; shooting = false; });
  target.addEventListener('wheel', (event) => {
    lookDY += event.deltaY * 0.4;
    event.preventDefault();
  }, { passive: false });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement: fwd -1..1 (W positive), strafe -1..1 (D positive), sprint bool. */
    move() {
      return {
        fwd: (hasAny(FWD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0),
        strafe: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        sprint: hasAny(SPRINT),
      };
    },
    /** Mouse-orbit delta since the last call, in pixels. */
    takeLook() {
      const d = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return d;
    },
    shooting() { return shooting; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

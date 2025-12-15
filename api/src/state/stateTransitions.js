// api/src/state/stateTransitions.js

export function canOpen(state) {
  return ["idle", "shared", "closed"].includes(state.mode);
}

export function isOpening(state) {
  return state.mode === "opening";
}

export function isOpen(state) {
  return state.mode === "open";
}

export function isClosing(state) {
  return state.mode === "closing";
}

export function isBlocked(state) {
  return ["blocked", "unavailable"].includes(state.mode);
}

// api/src/state/gridboxStateMachine.js

import { EVENTS } from "./events.js";

export function handleEvent({ box, event }) {
  const state =
    box.lifecycle?.state ||
    "idle";

  switch (event.type) {

    // =========================
    // SMS OPEN
    // =========================
    case EVENTS.SMS_OPEN: {

      if (state === "idle" || state === "closed") {
        return {
          action: "OPEN",
          nextState: {
            state: "opening"
          }
        };
      }

      if (state === "opening" || state === "open") {
        return { action: "IGNORE" };
      }

      if (state === "closing") {
        return { action: "REJECT" };
      }

      return { action: "IGNORE" };
    }

    // =========================
    // SMS CLOSE
    // =========================
    case EVENTS.SMS_CLOSE: {

      if (state === "open") {
        return {
          action: "CLOSE",
          nextState: {
            state: "closing"
          }
        };
      }

      if (state === "closing" || state === "closed") {
        return { action: "IGNORE" };
      }

      if (state === "opening") {
        return { action: "REJECT" };
      }

      return { action: "IGNORE" };
    }

    // =========================
    // DEVICE FEEDBACK (later)
    // =========================
    case EVENTS.DEVICE_OPENED: {
      return {
        action: "NONE",
        nextState: {
          state: "open"
        }
      };
    }

    case EVENTS.DEVICE_CLOSED: {
      return {
        action: "NONE",
        nextState: {
          state: "closed"
        }
      };
    }

    default:
      return { action: "IGNORE" };
  }
}

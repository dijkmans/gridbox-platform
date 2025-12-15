// api/src/state/gridboxStateMachine.js

import { EVENTS } from "./events.js";
import * as transitions from "./stateTransitions.js";

export async function handleEvent({ box, event, context }) {
  const state = box.state;

  switch (event.type) {

    case EVENTS.SMS_OPEN: {
      if (transitions.isBlocked(state)) {
        return { action: "REJECT", reason: "BOX_BLOCKED" };
      }

      if (transitions.canOpen(state)) {
        return {
          action: "OPEN",
          nextState: {
            mode: "opening",
            reason: "sms"
          }
        };
      }

      return { action: "IGNORE" };
    }

    case EVENTS.BUTTON_PRESSED: {
      return {
        action: "OPEN",
        nextState: {
          mode: "opening",
          reason: "button"
        }
      };
    }

    default:
      return { action: "IGNORE" };
  }
}

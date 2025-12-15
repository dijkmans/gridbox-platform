// api/src/state/gridboxStateMachine.js

import { EVENTS } from "./events.js";

export async function handleEvent({ box, event, context }) {
  // lifecycle is leidend
  const currentState = box.lifecycle?.state || "idle";

  switch (event.type) {

    // --------------------------------------------------
    // SMS OPEN
    // --------------------------------------------------
    case EVENTS.SMS_OPEN: {

      // Box is dicht en mag open
      if (currentState === "idle" || currentState === "closed") {
        return {
          action: "OPEN",
          nextState: {
            state: "opening",
            reason: "sms"
          }
        };
      }

      // Box is al bezig of al open
      if (currentState === "opening" || currentState === "open") {
        return { action: "IGNORE" };
      }

      return { action: "REJECT" };
    }

    // --------------------------------------------------
    // SMS CLOSE
    // --------------------------------------------------
    case EVENTS.SMS_CLOSE: {

      // Alleen sluiten als hij effectief open is
      if (currentState === "open") {
        return {
          action: "CLOSE",
          nextState: {
            state: "closing",
            reason: "sms"
          }
        };
      }

      // closing of closed → niets doen
      return { action: "IGNORE" };
    }

    // --------------------------------------------------
    // DEFAULT
    // --------------------------------------------------
    default:
      return { action: "IGNORE" };
  }
}

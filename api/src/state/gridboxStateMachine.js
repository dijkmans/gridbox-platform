// api/src/state/gridboxStateMachine.js

import { EVENTS } from "./events.js";

export async function handleEvent({ box, event, context }) {
  const currentState = box.state?.mode || "idle";

  switch (event.type) {

    // -------------------------
    // SMS OPEN
    // -------------------------
    case EVENTS.SMS_OPEN:

      if (currentState === "idle" || currentState === "closed") {
        return {
          action: "OPEN",
          nextState: {
            mode: "opening",
            reason: "sms"
          }
        };
      }

      if (currentState === "opening" || currentState === "open") {
        // OPEN opnieuw sturen heeft geen zin
        return { action: "IGNORE" };
      }

      return { action: "REJECT" };

    // -------------------------
    // SMS CLOSE
    // -------------------------
    case EVENTS.SMS_CLOSE:

      if (currentState === "open") {
        return {
          action: "CLOSE",
          nextState: {
            mode: "closing",
            reason: "sms"
          }
        };
      }

      return { action: "IGNORE" };

    // -------------------------
    // Default
    // -------------------------
    default:
      return { action: "IGNORE" };
  }
}

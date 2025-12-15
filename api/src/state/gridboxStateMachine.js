// api/src/state/gridboxStateMachine.js

import { EVENTS } from "./events.js";

export async function handleEvent({ box, event }) {
  const state = box.lifecycle?.state || "closed";

  switch (event.type) {

    case EVENTS.SMS_OPEN:
      if (state === "closed") {
        return {
          action: "OPEN",
          nextState: { state: "opening" }
        };
      }
      return { action: "IGNORE" };

    case EVENTS.SMS_CLOSE:
      if (state === "open") {
        return {
          action: "CLOSE",
          nextState: { state: "closing" }
        };
      }
      return { action: "IGNORE" };

    default:
      return { action: "IGNORE" };
  }
}

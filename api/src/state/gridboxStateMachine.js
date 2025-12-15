// api/src/state/gridboxStateMachine.js

import { EVENTS } from "./events.js";

/**
 * Gridbox State Machine
 *
 * lifecycle.state is LEIDEND
 * status is technisch (sensoren, deur, lock)
 */
export async function handleEvent({ box, event, context }) {

  const lifecycleState = box.lifecycle?.state || "closed";

  switch (event.type) {

    // =====================================================
    // SMS OPEN
    // =====================================================
    case EVENTS.SMS_OPEN: {

      // Box is dicht → mag openen
      if (lifecycleState === "closed") {
        return {
          action: "OPEN",
          nextState: {
            state: "opening",
            reason: "sms"
          }
        };
      }

      // Box is al bezig met openen
      if (lifecycleState === "opening") {
        return {
          action: "IGNORE"
        };
      }

      // Box is al open
      if (lifecycleState === "open") {
        return {
          action: "IGNORE"
        };
      }

      // In alle andere gevallen
      return {
        action: "REJECT"
      };
    }

    // =====================================================
    // SMS CLOSE
    // =====================================================
    case EVENTS.SMS_CLOSE: {

      // Enkel sluiten als box open is
      if (lifecycleState === "open") {
        return {
          action: "CLOSE",
          nextState: {
            state: "closing",
            reason: "sms"
          }
        };
      }

      // Als al aan het sluiten
      if (lifecycleState === "closing") {
        return {
          action: "IGNORE"
        };
      }

      // Sluiten terwijl hij al dicht is → negeren
      if (lifecycleState === "closed") {
        return {
          action: "IGNORE"
        };
      }

      return {
        action: "REJECT"
      };
    }

    // =====================================================
    // DEFAULT
    // =====================================================
    default:
      return {
        action: "IGNORE"
      };
  }
}

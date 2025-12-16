import { fetchCommands, ackCommand, sendStatus } from "./apiClient.js";

/**
 * Simulator Agent
 * Doet alsof dit een Raspberry Pi is
 * Stuurt status naar de API
 * (command polling is tijdelijk UIT)
 */
export function startSimulatorAgent({
  boxId,
  shutterController,
  lightController,
  stateManager
}) {

  /**
   * Interne helper om status te pushen
   */
  function pushStatus(source = "simulator") {
    sendStatus(boxId, {
      online: true,
      state: stateManager.getState(),
      source,
      type: "status"
    });
  }

  // --------------------------------------------------
  // INIT
  // --------------------------------------------------

  // Stuur meteen status bij opstart
  pushStatus("startup");

  // --------------------------------------------------
  // HEARTBEAT
  // --------------------------------------------------

  setInterval(() => {
    sendStatus(boxId, {
      online: true,
      state: stateManager.getState(),
      type: "heartbeat"
    });
  }, 30000);

  // --------------------------------------------------
  // COMMAND POLLING (TIJDELIJK UIT)
  // --------------------------------------------------
  // Dit blijft uit tot /api/commands bestaat
  /*
  setInterval(async () => {
    const commands = await fetchCommands(boxId);

    for (const cmd of commands) {
      try {
        if (cmd.type === "open") {
          shutterController.open("platform");
          lightController.onOpen();
          pushStatus("command-open");
        }

        if (cmd.type === "close") {
          shutterController.close("platform");
          lightController.onClose();
          pushStatus("command-close");
        }

        await ackCommand(boxId, cmd.id, "ok");
      } catch (err) {
        await ackCommand(boxId, cmd.id, "error");
      }
    }
  }, 3000);
  */

  // --------------------------------------------------
  // STATUS BIJ MANUELE ACTIES
  // --------------------------------------------------

  if (typeof stateManager.onChange === "function") {
    stateManager.onChange(() => {
      pushStatus("button");
    });
  }
}

import { fetchCommands, ackCommand, sendStatus } from "./apiClient.js";

export function startSimulatorAgent({
  boxId,
  shutterController,
  lightController,
  stateManager
}) {
  // heartbeat
  setInterval(() => {
    sendStatus(boxId, {
      online: true,
      state: stateManager.getState(),
      type: "heartbeat"
    });
  }, 30000);

  // command polling
  setInterval(async () => {
    const commands = await fetchCommands(boxId);

    for (const cmd of commands) {
      try {
        if (cmd.type === "open") {
          shutterController.open("platform");
          lightController.onOpen();
        }

        if (cmd.type === "close") {
          shutterController.close("platform");
          lightController.onClose();
        }

        await ackCommand(boxId, cmd.id, "ok");
      } catch (err) {
        await ackCommand(boxId, cmd.id, "error");
      }
    }
  }, 3000);
}

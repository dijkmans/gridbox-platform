import { SerialPort } from "serialport";
import { sendEvent } from "./api.js";
import { log } from "./logger.js";

export async function initRFID(config) {
  const port = new SerialPort({
    path: config.rfidPort,
    baudRate: 9600
  });

  port.on("data", data => {
    const tag = data.toString().trim();
    log("RFID gelezen: " + tag);
    sendEvent("rfid", { tag });
  });

  log("RFID actief");
}

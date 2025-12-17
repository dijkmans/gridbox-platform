// raspberry-pi/agent/src/hardwareStub.js

export function createHardwareStub({ boxId }) {
  function log(...args) {
    console.log(`[HARDWARE ${boxId}]`, ...args);
  }

  async function openShutter() {
    log("OPEN: rolluik openen (simulatie)");
    await sleep(1500);
    log("OPEN: rolluik is open");
  }

  async function closeShutter() {
    log("CLOSE: rolluik sluiten (simulatie)");
    await sleep(1500);
    log("CLOSE: rolluik is gesloten");
  }

  return {
    openShutter,
    closeShutter
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

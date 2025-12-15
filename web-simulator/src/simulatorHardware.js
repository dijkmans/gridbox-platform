export function initSimulatorHardware() {
  let shutterOpen = false;
  let buttonCallback = null;

  const shutterEl = document.getElementById("shutter");
  const lightEl = document.getElementById("light");

  function updateUI() {
    if (shutterEl) {
      shutterEl.textContent = shutterOpen ? "open" : "closed";
    }
  }

  return {
    onButtonPress(cb) {
      buttonCallback = cb;
    },

    relayOpen() {
      shutterOpen = true;
      updateUI();
      console.log("SIM: relay OPEN");
    },

    relayClose() {
      shutterOpen = false;
      updateUI();
      console.log("SIM: relay CLOSE");
    },

    lightOn() {
      if (lightEl) lightEl.classList.add("on");
      console.log("SIM: light ON");
    },

    lightOff() {
      if (lightEl) lightEl.classList.remove("on");
      console.log("SIM: light OFF");
    },

    isShutterOpen() {
      return shutterOpen;
    },

    simulateButtonPress() {
      if (buttonCallback) buttonCallback();
    }
  };
}

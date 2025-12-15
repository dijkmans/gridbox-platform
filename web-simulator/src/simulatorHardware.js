export function initSimulatorHardware() {
  let shutterOpen = false;
  let buttonCallback = null;

  const shutterEl = document.getElementById("shutter");
  const lightEl = document.getElementById("light");

  function updateUI() {
    shutterEl.textContent = shutterOpen ? "open" : "closed";
  }

  return {
    onButtonPress(cb) {
      buttonCallback = cb;
    },

    relayOpen() {
      shutterOpen = true;
      updateUI();
    },

    relayClose() {
      shutterOpen = false;
      updateUI();
    },

    lightOn() {
      lightEl.classList.add("on");
    },

    lightOff() {
      lightEl.classList.remove("on");
    },

    isShutterOpen() {
      return shutterOpen;
    },

    simulateButton() {
      if (buttonCallback) buttonCallback();
    }
  };
}

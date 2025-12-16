export function initSimulatorHardware() {
  let shutterOpen = false;
  let lightOn = false;
  let buttonCallback = null;

  const shutterEl = document.getElementById("shutter");
  const lightEl = document.getElementById("light");

  function updateUI() {
    if (shutterEl) {
      shutterEl.textContent = shutterOpen ? "open" : "closed";
    }

    if (lightEl) {
      if (lightOn) {
        lightEl.classList.add("on");
      } else {
        lightEl.classList.remove("on");
      }
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
      lightOn = true;
      updateUI();
      console.log("SIM: light ON");
    },

    lightOff() {
      lightOn = false;
      updateUI();
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

// raspberry-pi/agent/hardware/raspberryHardware.js

export function initHardware() {
  console.log("Initializing Raspberry Pi hardware (stub)");

  let shutterOpen = false;
  let buttonCallback = null;

  return {
    onButtonPress(callback) {
      buttonCallback = callback;
      console.log("Button handler registered");
    },

    // Deze functies worden door gridbox-core aangeroepen
    relayOpen() {
      console.log("RELAY OPEN");
      shutterOpen = true;
    },

    relayClose() {
      console.log("RELAY CLOSE");
      shutterOpen = false;
    },

    lightOn() {
      console.log("LIGHT ON");
    },

    lightOff() {
      console.log("LIGHT OFF");
    },

    isShutterOpen() {
      return shutterOpen;
    },

    // Tijdelijke testfunctie (kan je later verwijderen)
    _simulateButtonPress() {
      if (buttonCallback) {
        buttonCallback();
      }
    }
  };
}

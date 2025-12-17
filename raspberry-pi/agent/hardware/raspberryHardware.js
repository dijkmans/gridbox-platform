// raspberry-pi/agent/hardware/raspberryHardware.js
// Hardware-adapter voor echte Raspberry Pi
// Bevat GEEN logica, enkel fysieke aansturing

export function createRaspberryHardware() {
  console.log("[HW] Raspberry Pi hardware initialiseren");

  let buttonCallback = null;

  return {
    // ---------------------------------
    // Fysieke knop
    // ---------------------------------
    onButtonPress(callback) {
      buttonCallback = callback;
      console.log("[HW] Button handler geregistreerd");
    },

    // ---------------------------------
    // Rolluik
    // ---------------------------------
    async open() {
      console.log("[HW] ROLLUIK OPEN (GPIO)");
      // hier komt later echte GPIO-aansturing
    },

    async close() {
      console.log("[HW] ROLLUIK SLUITEN (GPIO)");
      // hier komt later echte GPIO-aansturing
    },

    // ---------------------------------
    // Licht
    // ---------------------------------
    async lightOn() {
      console.log("[HW] LICHT AAN");
      // GPIO HIGH
    },

    async lightOff() {
      console.log("[HW] LICHT UIT");
      // GPIO LOW
    },

    // ---------------------------------
    // Simulator / test helper
    // ---------------------------------
    _simulateButtonPress() {
      if (buttonCallback) {
        console.log("[HW] Gesimuleerde knopdruk");
        buttonCallback();
      }
    }
  };
}

// raspberry-pi/agent/src/hardware/simHardware.js

export function createSimHardware() {
  return {
    async open() {
      console.log("[SIM HW] open");
    },
    async close() {
      console.log("[SIM HW] close");
    }
  };
}

export const demoData = {
  groups: [
    {
      group: "Winkel Geel",
      boxes: [
        {
          id: "geel-7",
          boxNumber: 7,
          lastOpenedText: "21 minutes ago",

          shares: [
            { time: "10:12", phone: "+32470000123", comment: "Ophaling fiets", status: "ok" },
            { time: "09:50", phone: "+32470000999", comment: "Levering onderdeel", status: "ok" }
          ],

          events: [
            { timestamp: "10:12", type: "open",   source: "sms",     status: "ok" },
            { timestamp: "10:13", type: "close",  source: "auto",    status: "ok" },
            { timestamp: "10:15", type: "error",  source: "sensor",  status: "jammed" },
            { timestamp: "10:16", type: "camera", source: "system",  status: "snapshot taken" },
            { timestamp: "10:17", type: "open",   source: "app",     status: "manual override" }
          ],

          pictures: [
            { url: "https://picsum.photos/500?1" },
            { url: "https://picsum.photos/500?2" },
            { url: "https://picsum.photos/500?3" }
          ]
        }
      ]
    },

    {
      group: "Winkel Bocholt",
      boxes: [
        {
          id: "bocholt-3",
          boxNumber: 3,
          lastOpenedText: "2 hours ago",

          shares: [
            { time: "08:14", phone: "+32477888999", comment: "", status: "ok" }
          ],

          events: [
            { timestamp: "08:14", type: "open",   source: "app",     status: "ok" },
            { timestamp: "08:16", type: "close",  source: "auto",    status: "ok" },
            { timestamp: "08:18", type: "camera", source: "system",  status: "snapshot taken" },
            { timestamp: "08:20", type: "error",  source: "sensor",  status: "blocked" },
            { timestamp: "08:22", type: "open",   source: "sms",     status: "override by customer" }
          ],

          pictures: [
            { url: "https://picsum.photos/500?4" },
            { url: "https://picsum.photos/500?5" }
          ]
        },

        {
          id: "bocholt-4",
          boxNumber: 4,
          lastOpenedText: "5 hours ago",

          shares: [],

          events: [
            { timestamp: "07:01", type: "open",  source: "auto",    status: "daily maintenance" },
            { timestamp: "07:03", type: "close", source: "auto",    status: "ok" },
            { timestamp: "07:05", type: "camera", source: "system", status: "snapshot taken" }
          ],

          pictures: []
        }
      ]
    },

    {
      group: "Winkel Mol",
      boxes: [
        {
          id: "mol-5",
          boxNumber: 5,
          lastOpenedText: "Yesterday",

          shares: [],

          events: [
            { timestamp: "15:10", type: "open",   source: "sms",     status: "ok" },
            { timestamp: "15:12", type: "close",  source: "auto",    status: "ok" },
            { timestamp: "15:13", type: "camera", source: "system",  status: "snapshot taken" },
            { timestamp: "15:15", type: "error",  source: "sensor",  status: "door obstruction" }
          ],

          pictures: []
        }
      ]
    }
  ]
};

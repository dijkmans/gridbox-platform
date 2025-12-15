import { Router } from "express";
const router = Router();

router.get("/:deviceId", (req, res) => {
  res.json({
    deviceId: req.params.deviceId,
    autoCloseMinutes: 15,
    gpio: {
      rolluik_up: 27,
      rolluik_down: 17,
      light: 22
    }
  });
});

export default router;

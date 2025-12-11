import { Router } from "express";
const router = Router();

router.post("/send", (req, res) => {
  const { deviceId, command } = req.body;

  res.json({
    ok: true,
    message: "Commando ontvangen (mock)",
    deviceId,
    command
  });
});

export default router;

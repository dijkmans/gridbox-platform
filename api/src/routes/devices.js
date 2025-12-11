import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  res.json({ ok: true, message: "Devices endpoint werkt" });
});

router.get("/:id", (req, res) => {
  res.json({ ok: true, deviceId: req.params.id });
});

export default router;

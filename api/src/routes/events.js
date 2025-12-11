import { Router } from "express";
const router = Router();

router.post("/", (req, res) => {
  console.log("Event ontvangen:", req.body);
  res.json({ ok: true });
});

export default router;

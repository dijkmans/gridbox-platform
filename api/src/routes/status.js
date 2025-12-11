import { Router } from "express";
const router = Router();

router.post("/update", (req, res) => {
  console.log("Status update ontvangen:", req.body);
  res.json({ ok: true });
});

export default router;

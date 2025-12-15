import { Router } from "express";

const router = Router();

// Tijdelijke mock data (nulmeting)
const MOCK_BOXES = {
  "box-1": {
    id: "box-1",
    name: "Test Gridbox",
    status: "idle"
  }
};

// GET /api/boxes/:boxId
router.get("/:boxId", (req, res) => {
  const { boxId } = req.params;

  const box = MOCK_BOXES[boxId];

  if (!box) {
    return res.status(404).json({
      error: "Box niet gevonden"
    });
  }

  res.json(box);
});

export default router;


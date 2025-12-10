const express = require("express");
const router = express.Router();

const boxesService = require("../services/boxesService");

// GET /api/boxes
router.get("/", async (req, res) => {
  const boxes = await boxesService.getAll();
  res.json(boxes);
});

// GET /api/boxes/:id
router.get("/:id", async (req, res) => {
  const box = await boxesService.getById(req.params.id);
  res.json(box);
});

// GET /api/boxes/:id/shares
router.get("/:id/shares", async (req, res) => {
  const shares = await boxesService.getShares(req.params.id);
  res.json(shares);
});

// POST /api/boxes/:id/open
router.post("/:id/open", async (req, res) => {
  const result = await boxesService.open(req.params.id);
  res.json(result);
});

// POST /api/boxes/:id/close
router.post("/:id/close", async (req, res) => {
  const result = await boxesService.close(req.params.id);
  res.json(result);
});

module.exports = router;

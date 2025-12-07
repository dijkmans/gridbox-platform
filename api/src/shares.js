// src/shares.js
const express = require("express");
const router = express.Router();
const db = require("./db");

router.post("/", async (req, res, next) => {
  try {
    const { boxId, phoneNumber } = req.body;

    if (!boxId || !phoneNumber) {
      return res
        .status(400)
        .json({ error: "boxId en phoneNumber zijn verplicht" });
    }

    // Later kunnen we hier nog checken of de box bestaat, enz.
    const share = await db.createShare({ boxId, phoneNumber });

    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
});

module.exports = router;


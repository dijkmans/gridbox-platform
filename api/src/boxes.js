// api/src/boxes.js

const { getBox } = require("./db");

async function getBoxHandler(req, res) {
  try {
    const { boxId } = req.params;
    const box = await getBox(boxId);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json(box);
  } catch (err) {
    console.error("Fout bij ophalen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
}

module.exports = {
  getBoxHandler,
};

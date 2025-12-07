// Alle boxen
app.get("/api/boxes", async (req, res, next) => {
  try {
    const boxes = await getAllBoxes();  // await
    res.json(boxes);
  } catch (err) {
    next(err);
  }
});

// Eén box
app.get("/api/boxes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const box = await getBoxById(id);   // await

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json(box);
  } catch (err) {
    next(err);
  }
});

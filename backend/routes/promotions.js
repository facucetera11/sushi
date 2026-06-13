const express = require("express");
const router = express.Router();
const Promotion = require("../models/Promotion");
const { requireAdmin } = require("../middleware/auth");
const { getActivePromotions } = require("../utils/promoEngine");

// GET /promotions  -> todas (admin) o solo activas/vigentes (publico via ?active=1)
router.get("/", async (req, res) => {
  try {
    if (req.query.active === "1") {
      return res.json(await getActivePromotions());
    }
    res.json(await Promotion.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener promociones" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const promo = new Promotion(req.body);
    await promo.save();
    if (req.app.locals.broadcast) req.app.locals.broadcast("promotions_updated", {});
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: "Error al crear promocion", detalle: err.message });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promo) return res.status(404).json({ error: "Promocion no encontrada" });
    if (req.app.locals.broadcast) req.app.locals.broadcast("promotions_updated", {});
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar promocion", detalle: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const promo = await Promotion.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ error: "Promocion no encontrada" });
    if (req.app.locals.broadcast) req.app.locals.broadcast("promotions_updated", {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar promocion" });
  }
});

module.exports = router;
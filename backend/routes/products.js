const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");

router.get("/", async (req, res) => {
  try { res.json(await Product.find()); }
  catch (err) { res.status(500).json({ error: "Error al obtener productos" }); }
});

router.post("/", requireAdmin, async (req, res) => {
  try { const p = new Product(req.body); await p.save(); res.json(p); }
  catch (err) { res.status(400).json({ error: "Error al crear producto", detalle: err.message }); }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(p);
  } catch (err) { res.status(400).json({ error: "Error al actualizar producto", detalle: err.message }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar producto" }); }
});

module.exports = router;

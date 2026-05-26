const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Product = require("./models/Product");
const Order = require("./models/Order");
const Settings = require("./models/Settings");

const app = express();
app.use(cors());
app.use(express.json());

function getStockRecipe(product) {
  const recipe = Array.isArray(product.stockItems)
    ? product.stockItems.filter(item => item.product && item.pieces > 0)
    : [];
  if (recipe.length) return recipe;
  return [{ product: product._id, pieces: product.piecesPerUnit || 1 }];
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => { console.error("❌ Error conectando a MongoDB:", err.message); process.exit(1); });

/* ── AUTH ── */
app.post("/auth", (req, res) => {
  const { password } = req.body;
  if (!process.env.ADMIN_PASSWORD)
    return res.status(500).json({ error: "ADMIN_PASSWORD no configurada en el servidor" });
  if (password === process.env.ADMIN_PASSWORD)
    return res.json({ ok: true });
  return res.status(401).json({ error: "Contraseña incorrecta" });
});

/* ── PRODUCTS ── */
app.get("/products", async (req, res) => {
  try { res.json(await Product.find()); }
  catch (err) { res.status(500).json({ error: "Error al obtener productos" }); }
});

app.post("/products", async (req, res) => {
  try { const p = new Product(req.body); await p.save(); res.json(p); }
  catch (err) { res.status(400).json({ error: "Error al crear producto", detalle: err.message }); }
});

app.put("/products/:id", async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(p);
  } catch (err) { res.status(400).json({ error: "Error al actualizar producto", detalle: err.message }); }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar producto" }); }
});

/* ── SETTINGS ── */
app.get("/settings", async (req, res) => {
  try {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({ openHour: 19, closeHour: 23, openDays: [1,2,3,4,5,6], cashDiscount: 0, transferAlias: "", mercadoPagoLink: "", whatsappNumber: "5491121734894" });
    res.json(s);
  } catch (err) { res.status(500).json({ error: "Error al obtener configuración" }); }
});

app.put("/settings", async (req, res) => {
  try {
    let s = await Settings.findOne();
    if (!s) s = new Settings(req.body);
    else Object.assign(s, req.body);
    await s.save();
    res.json(s);
  } catch (err) { res.status(500).json({ error: "Error al guardar configuración" }); }
});

/* ── ORDERS ── */
app.get("/orders", async (req, res) => {
  try { res.json(await Order.find().sort({ number: -1 })); }
  catch (err) { res.status(500).json({ error: "Error al obtener pedidos" }); }
});

app.post("/orders", async (req, res) => {
  try {
    const { items, total, deliveryType, address, clientName, clientPhone, notes, scheduledDate, scheduledTime, paymentMethod } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "El pedido no tiene productos" });
    }

    // Validar stock y calcular piezas a descontar por tipo de sushi.
    const stockDeductions = new Map();
    for (const item of items) {
      const product = await Product.findById(item._id);
      if (!product) return res.status(400).json({ error: `Producto no encontrado: ${item.name}` });

      const qty = Number(item.qty) || 0;
      if (qty <= 0) return res.status(400).json({ error: `Cantidad invalida para: ${item.name}` });

      for (const recipeItem of getStockRecipe(product)) {
        const id = recipeItem.product.toString();
        const pieces = (Number(recipeItem.pieces) || 0) * qty;
        stockDeductions.set(id, (stockDeductions.get(id) || 0) + pieces);
      }
    }

    const stockProducts = await Product.find({ _id: { $in: [...stockDeductions.keys()] } });
    const stockById = new Map(stockProducts.map(product => [product._id.toString(), product]));
    const stockDeductionDetails = [];
    for (const [id, pieces] of stockDeductions) {
      const product = stockById.get(id);
      if (!product) return res.status(400).json({ error: "Producto de stock no encontrado" });
      if (product.stock < pieces) {
        return res.status(400).json({ error: `Stock insuficiente para: ${product.name}` });
      }
      stockDeductionDetails.push({ product: id, name: product.name, pieces });
    }

    const last = await Order.findOne().sort({ number: -1 });
    const order = new Order({
      number: last ? last.number + 1 : 1,
      items,
      total,
      deliveryType: deliveryType || "retiro",
      address: address || "",
      clientName: clientName || "",
      clientPhone: clientPhone || "",
      notes: notes || "",
      scheduledDate: scheduledDate || "",
      scheduledTime: scheduledTime || "",
      paymentMethod: paymentMethod || "transfer",
      stockDeductions: stockDeductionDetails
    });
    await order.save();

    // Descontar stock en piezas por tipo de sushi.
    for (const [id, pieces] of stockDeductions) {
      await Product.findByIdAndUpdate(id, { $inc: { stock: -pieces } });
    }

    res.json(order);
  } catch (err) { res.status(400).json({ error: "Error al crear pedido", detalle: err.message }); }
});

app.put("/orders/:id", async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(o);
  } catch (err) { res.status(400).json({ error: "Error al actualizar pedido", detalle: err.message }); }
});

app.delete("/orders/:id", async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar pedido" }); }
});

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 5000}`);
});

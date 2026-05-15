const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Product = require("./models/Product");
const Order = require("./models/Order");

const app = express();

app.use(cors());
app.use(express.json());

// Conexión a MongoDB con manejo de error
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => {
    console.error("❌ Error conectando a MongoDB:", err.message);
    process.exit(1); // Si no hay DB, no tiene sentido seguir
  });

/* SETTINGS */

const SettingsSchema = new mongoose.Schema({
  openHour: Number,
  closeHour: Number,
  openDays: [Number]
});

const Settings = mongoose.model("Settings", SettingsSchema);

/* PRODUCTS */

app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

app.post("/products", async (req, res) => {
  try {
    const p = new Product(req.body);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: "Error al crear producto", detalle: err.message });
  }
});

app.put("/products/:id", async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar producto", detalle: err.message });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

/* SETTINGS */

app.get("/settings", async (req, res) => {
  try {
    let s = await Settings.findOne();
    if (!s) {
      s = await Settings.create({
        openHour: 19,
        closeHour: 23,
        openDays: [1, 2, 3, 4, 5, 6]
      });
    }
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

app.put("/settings", async (req, res) => {
  try {
    let s = await Settings.findOne();
    if (!s) s = new Settings(req.body);
    else Object.assign(s, req.body);
    await s.save();
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar configuración" });
  }
});

/* ORDERS */

app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ number: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

app.post("/orders", async (req, res) => {
  try {
    const last = await Order.findOne().sort({ number: -1 });
    const order = new Order({
      number: last ? last.number + 1 : 1,
      items: req.body.items,
      total: req.body.total
    });
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: "Error al crear pedido", detalle: err.message });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(o);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar pedido", detalle: err.message });
  }
});

// Ruta no encontrada (404 genérico)
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 5000}`);
});
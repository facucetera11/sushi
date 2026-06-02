const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const Product = require("./models/Product");
const Order = require("./models/Order");
const Settings = require("./models/Settings");

const app = express();
app.disable("x-powered-by");
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(",").map(origin => origin.trim()) : true
}));
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const authAttempts = new Map();
const orderAttempts = new Map();

function rateLimit(store, limit, windowMs) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const current = store.get(key) || { count: 0, resetAt: now + windowMs };
    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }
    current.count += 1;
    store.set(key, current);
    if (current.count > limit) {
      return res.status(429).json({ error: "Demasiados intentos. Proba de nuevo en unos minutos." });
    }
    next();
  };
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signTokenPayload(payload) {
  const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET o ADMIN_PASSWORD no configurado");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createToken(version = 0) {
  const payload = base64url({ role: "admin", version, exp: Date.now() + TOKEN_TTL_MS });
  return `${payload}.${signTokenPayload(payload)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = hashPassword(password, salt).hash;
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

async function getSettings() {
  let s = await Settings.findOne();
  if (!s) {
    s = await Settings.create({ openHour: 19, closeHour: 23, openDays: [1,2,3,4,5,6], cashDiscount: 0, transferAlias: "", mercadoPagoLink: "", whatsappNumber: "5491121734894", acceptingOrders: true });
  }
  return s;
}

function publicSettings(settings) {
  const data = settings.toObject ? settings.toObject() : settings;
  delete data.adminPasswordHash;
  delete data.adminPasswordSalt;
  delete data.adminTokenVersion;
  return data;
}

async function isAdminPassword(password) {
  const s = await getSettings();
  if (s.adminPasswordHash && s.adminPasswordSalt) {
    return verifyPassword(password, s.adminPasswordSalt, s.adminPasswordHash);
  }
  return Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
}

async function requireAdmin(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const [payload, signature] = token.split(".");
    if (!payload || !signature || signature !== signTokenPayload(payload)) {
      return res.status(401).json({ error: "Sesion invalida" });
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const s = await getSettings();
    if (data.role !== "admin" || data.exp < Date.now() || data.version !== (s.adminTokenVersion || 0)) {
      return res.status(401).json({ error: "Sesion vencida" });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: "Sesion invalida" });
  }
}

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

app.get("/health", (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    service: "kizuna-api",
    database: dbReady ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/* ── AUTH ── */
app.post("/auth", rateLimit(authAttempts, 8, 15 * 60 * 1000), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Ingresa la contrasena" });
    const s = await getSettings();
    if (await isAdminPassword(password)) {
      return res.json({ ok: true, token: createToken(s.adminTokenVersion || 0) });
    }
    return res.status(401).json({ error: "Contrasena incorrecta" });
  } catch (err) {
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

app.post("/auth/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "La nueva contrasena debe tener al menos 8 caracteres" });
    }
    if (!(await isAdminPassword(currentPassword || ""))) {
      return res.status(400).json({ error: "La contrasena actual no es correcta" });
    }
    const s = await getSettings();
    const { salt, hash } = hashPassword(newPassword);
    s.adminPasswordSalt = salt;
    s.adminPasswordHash = hash;
    s.adminTokenVersion = (s.adminTokenVersion || 0) + 1;
    await s.save();
    res.json({ ok: true, token: createToken(s.adminTokenVersion) });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar contrasena" });
  }
});

/* ── PRODUCTS ── */
app.get("/products", async (req, res) => {
  try { res.json(await Product.find()); }
  catch (err) { res.status(500).json({ error: "Error al obtener productos" }); }
});

app.post("/products", requireAdmin, async (req, res) => {
  try { const p = new Product(req.body); await p.save(); res.json(p); }
  catch (err) { res.status(400).json({ error: "Error al crear producto", detalle: err.message }); }
});

app.put("/products/:id", requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(p);
  } catch (err) { res.status(400).json({ error: "Error al actualizar producto", detalle: err.message }); }
});

app.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar producto" }); }
});

/* ── SETTINGS ── */
app.get("/settings", async (req, res) => {
  try {
    res.json(publicSettings(await getSettings()));
  } catch (err) { res.status(500).json({ error: "Error al obtener configuración" }); }
});

app.put("/settings", requireAdmin, async (req, res) => {
  try {
    const allowed = ["openHour", "closeHour", "openDays", "cashDiscount", "transferAlias", "mercadoPagoLink", "whatsappNumber", "acceptingOrders"];
    const updates = {};
    allowed.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    });
    let s = await getSettings();
    Object.assign(s, updates);
    await s.save();
    res.json(publicSettings(s));
  } catch (err) { res.status(500).json({ error: "Error al guardar configuración" }); }
});

/* ── ORDERS ── */
app.get("/orders", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const skip = parseInt(req.query.skip) || 0;
    res.json(await Order.find().sort({ number: -1 }).skip(skip).limit(limit));
  }
  catch (err) { res.status(500).json({ error: "Error al obtener pedidos" }); }
});

app.post("/orders", rateLimit(orderAttempts, 20, 10 * 60 * 1000), async (req, res) => {
  try {
    const { items, total, deliveryType, address, clientName, clientPhone, notes, scheduledDate, scheduledTime, paymentMethod } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "El pedido no tiene productos" });
    }

    const settings = await Settings.findOne();
    if (settings && settings.acceptingOrders === false) {
      return res.status(403).json({ error: "El local esta cerrado y no esta aceptando pedidos en este momento" });
    }

    // Validar stock y calcular piezas a descontar por tipo de sushi.
    const stockDeductions = new Map();
    for (const item of items) {
      const product = await Product.findById(item._id);
      if (!product) return res.status(400).json({ error: `Producto no encontrado: ${item.name}` });
      if (product.active === false) return res.status(400).json({ error: `Producto no disponible: ${product.name}` });

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

app.put("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(o);
  } catch (err) { res.status(400).json({ error: "Error al actualizar pedido", detalle: err.message }); }
});

app.delete("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    // Restaurar stock de las piezas descontadas al crear el pedido
    if (Array.isArray(o.stockDeductions) && o.stockDeductions.length) {
      await Promise.all(o.stockDeductions.map(d =>
        Product.findByIdAndUpdate(d.product, { $inc: { stock: d.pieces } })
      ));
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar pedido" }); }
});

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 5000}`);
});
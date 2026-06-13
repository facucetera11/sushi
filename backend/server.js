const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Order = require("./models/Order");
const Settings = require("./models/Settings");

const app = express();
app.disable("x-powered-by");
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map(o => o.trim())
    : true
}));
app.use(express.json({ limit: "6mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

/* ── SSE ── */
const sseClients = new Set();

function broadcast(type, data) {
  const msg = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

// Exponemos broadcast a los routers vía app.locals
app.locals.broadcast = broadcast;

const { requireAdmin } = require("./middleware/auth");

app.get("/events", requireAdmin, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); sseClients.delete(res); }
  }, 25000);

  req.on("close", () => { clearInterval(heartbeat); sseClients.delete(res); });
});

/* ── HEALTH ── */
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

/* ── ROUTES ── */
app.use("/auth",     require("./routes/auth"));
app.use("/products", require("./routes/products"));
app.use("/settings", require("./routes/settings").router);
app.use("/orders",   require("./routes/orders"));

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

/* ── DB + ARRANQUE ── */
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB conectado");
    const s = await Settings.findOne();
    if (s && (s._orderSeq || 0) === 0) {
      const last = await Order.findOne().sort({ number: -1 });
      if (last && last.number > 0) {
        await Settings.findOneAndUpdate({}, { $set: { _orderSeq: last.number } });
        console.log(`✅ Contador de pedidos inicializado en ${last.number}`);
      }
    }
  })
  .catch(err => { console.error("❌ Error conectando a MongoDB:", err.message); process.exit(1); });

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 5000}`);
});

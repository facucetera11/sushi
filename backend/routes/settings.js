const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const { requireAdmin } = require("../middleware/auth");

const ALLOWED_SETTINGS = [
  "openHour", "closeHour", "deliveryHour", "openDays",
  "cashDiscount", "transferAlias", "mercadoPagoLink",
  "whatsappNumber", "acceptingOrders"
];

async function getSettings() {
  let s = await Settings.findOne();
  if (!s) {
    s = await Settings.create({
      openHour: 19, closeHour: 23, openDays: [1,2,3,4,5,6],
      cashDiscount: 0, transferAlias: "", mercadoPagoLink: "",
      whatsappNumber: "5491121734894", acceptingOrders: true
    });
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

router.get("/", async (req, res) => {
  try { res.json(publicSettings(await getSettings())); }
  catch (err) { res.status(500).json({ error: "Error al obtener configuración" }); }
});

router.put("/", requireAdmin, async (req, res) => {
  try {
    const updates = {};
    ALLOWED_SETTINGS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    });
    const s = await getSettings();
    Object.assign(s, updates);
    await s.save();
    res.json(publicSettings(s));
  } catch (err) { res.status(500).json({ error: "Error al guardar configuración" }); }
});

module.exports = { router, getSettings, publicSettings };

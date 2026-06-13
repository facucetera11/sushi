const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  openHour: Number,
  closeHour: Number,
  deliveryHour: { type: Number, default: null },
  openDays: [Number],
  cashDiscount: { type: Number, default: 0 },
  transferAlias: { type: String, default: "" },
  mercadoPagoLink: { type: String, default: "" },
  whatsappNumber: { type: String, default: "5491121734894" },
  acceptingOrders: { type: Boolean, default: true },
  adminPasswordHash: { type: String, default: "" },
  adminPasswordSalt: { type: String, default: "" },
  adminTokenVersion: { type: Number, default: 0 },
  _orderSeq: { type: Number, default: 0 },
  customCategories: { type: [String], default: [] }
});

module.exports = mongoose.model("Settings", SettingsSchema);
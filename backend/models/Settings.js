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
  comboEleccionPrices: {
    type: { p8: Number, p16: Number, p35: Number },
    default: { p8: 0, p16: 0, p35: 0 }
  },
  adminPasswordHash: { type: String, default: "" },
  adminPasswordSalt: { type: String, default: "" },
  adminTokenVersion: { type: Number, default: 0 },
  _orderSeq: { type: Number, default: 0 }
});

module.exports = mongoose.model("Settings", SettingsSchema);
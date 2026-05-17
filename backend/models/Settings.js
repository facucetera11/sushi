const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  openHour: Number,
  closeHour: Number,
  openDays: [Number],
  cashDiscount: { type: Number, default: 0 },
  transferAlias: { type: String, default: "" },
  mercadoPagoLink: { type: String, default: "" }
});

module.exports = mongoose.model("Settings", SettingsSchema);
const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  openHour: Number,
  closeHour: Number,
  openDays: [Number]
});

module.exports = mongoose.model("Settings", SettingsSchema);
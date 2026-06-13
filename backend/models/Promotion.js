const mongoose = require("mongoose");

const PromotionSchema = new mongoose.Schema({
  label: { type: String, required: true },          // ej: "🔥 2x1 en Rolls", "-20% Bebidas"
  type: {
    type: String,
    required: true,
    enum: ["percent", "2x1", "fixed_price", "bundle"]
  },
  // Para "percent": value = porcentaje de descuento (ej 20)
  // Para "fixed_price": value = precio fijo total a pagar por la cantidad indicada en "quantity"
  // Para "2x1": no usa value (se calcula automático), quantity fijo en 2
  // Para "bundle": value = precio fijo total del conjunto de productIds (uno de cada)
  value: { type: Number, default: 0 },
  quantity: { type: Number, default: 2 }, // usado por fixed_price ("pagás X por N unidades")

  // Alcance de la promo
  scope: { type: String, enum: ["products", "categories"], required: true },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  categories: [{ type: String }],

  active: { type: Boolean, default: true },
  startDate: { type: String, default: "" }, // YYYY-MM-DD, opcional
  endDate: { type: String, default: "" },   // YYYY-MM-DD, opcional

  badgeColor: { type: String, default: "#d86a5e" },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Promotion", PromotionSchema);
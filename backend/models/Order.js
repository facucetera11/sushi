const mongoose=require("mongoose");

const OrderSchema=new mongoose.Schema({
  number: Number,
  items: Array,
  stockDeductions: {
    type: [{
      product: String,
      name: String,
      pieces: Number
    }],
    default: []
  },
  total: Number,
  status: { type: String, default: "Pendiente" },
  deliveryType: { type: String, default: "retiro" }, // "retiro" | "delivery"
  address: { type: String, default: "" },
  clientName: { type: String, default: "" },
  clientPhone: { type: String, default: "" },
  notes: { type: String, default: "" },
  scheduledDate: { type: String, default: "" },
  scheduledTime: { type: String, default: "" },
  paymentMethod: { type: String, default: "transfer" }, // "transfer" | "cash"
  createdAt: { type: Date, default: Date.now }
});

OrderSchema.index({ number: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports=mongoose.model("Order",OrderSchema);
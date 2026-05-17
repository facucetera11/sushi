const mongoose=require("mongoose");

const OrderSchema=new mongoose.Schema({
  number: Number,
  items: Array,
  total: Number,
  status: { type: String, default: "Pendiente" },
  deliveryType: { type: String, default: "retiro" }, // "retiro" | "delivery"
  address: { type: String, default: "" },
  clientName: { type: String, default: "" },
  scheduledDate: { type: String, default: "" },
  scheduledTime: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

module.exports=mongoose.model("Order",OrderSchema);
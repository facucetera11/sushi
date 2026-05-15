const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  image: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model("Product", ProductSchema);
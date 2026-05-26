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
  },
  piecesPerUnit: {
    type: Number,
    required: true,
    default: 1
  },
  stockItems: {
    type: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
      },
      pieces: {
        type: Number,
        required: true,
        min: 1
      }
    }],
    default: []
  }
});

module.exports = mongoose.model("Product", ProductSchema);

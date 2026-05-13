require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   MONGODB
========================= */

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("✅ Mongo conectado");
})
.catch((err) => {
    console.log("❌ Error MongoDB");
    console.log(err);
});

/* =========================
   MODELO PRODUCTO
========================= */

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

    category: {
        type: String,
        required: true
    }

});

const Product = mongoose.model("Product", ProductSchema);

/* =========================
   RUTAS
========================= */

/* Obtener productos */

app.get("/products", async (req, res) => {

    try {

        const products = await Product.find();

        res.json(products);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: err.message
        });

    }

});

/* Crear producto */

app.post("/products", async (req, res) => {

    try {

        const product = new Product(req.body);

        await product.save();

        res.json(product);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: err.message
        });

    }

});

/* Editar producto */

app.put("/products/:id", async (req, res) => {

    try {

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(product);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: err.message
        });

    }

});

/* Eliminar producto */

app.delete("/products/:id", async (req, res) => {

    try {

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            ok: true
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: err.message
        });

    }

});

/* Comprar producto */

app.post("/buy/:id", async (req, res) => {

    try {

        const product = await Product.findById(req.params.id);

        if (!product) {

            return res.status(404).json({
                message: "Producto no encontrado"
            });

        }

        if (product.stock > 0) {

            product.stock--;

            await product.save();

            res.json(product);

        } else {

            res.status(400).json({
                message: "Sin stock"
            });

        }

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: err.message
        });

    }

});

/* =========================
   SERVIDOR
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
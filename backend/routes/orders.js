const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const Settings = require("../models/Settings");
const rateLimit = require("../middleware/rateLimit");
const { requireAdmin } = require("../middleware/auth");

const { calculateOrderTotal, getActivePromotions } = require("../utils/promoEngine");

const orderAttempts = new Map();

function getStockRecipe(product, itemOverride) {
  if (itemOverride && itemOverride._piecesOverride > 0) {
    return [{ product: product._id, pieces: itemOverride._piecesOverride }];
  }
  const recipe = Array.isArray(product.stockItems)
    ? product.stockItems.filter(item => item.product && item.pieces > 0)
    : [];
  if (recipe.length) return recipe;
  return [{ product: product._id, pieces: product.piecesPerUnit || 1 }];
}

function getComboPiecePrice(product) {
  const customPrice = Number(product.comboPiecePrice) || 0;
  if (customPrice > 0) return customPrice;
  const unitPrice = Number(product.price) || 0;
  const piecesPerUnit = Number(product.piecesPerUnit) || 1;
  return Math.round(unitPrice / piecesPerUnit);
}

// GET /orders
// Soporta: ?limit=N &skip=N &from=YYYY-MM-DD &to=YYYY-MM-DD &status=Pendiente
router.get("/", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const skip  = parseInt(req.query.skip) || 0;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (!isNaN(from)) filter.createdAt.$gte = from;
      }
      if (req.query.to) {
        // Incluir todo el día "to" hasta las 23:59:59
        const to = new Date(req.query.to);
        if (!isNaN(to)) {
          to.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = to;
        }
      }
    }

    res.json(await Order.find(filter).sort({ number: -1 }).skip(skip).limit(limit));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

// POST /orders
router.post("/", rateLimit(orderAttempts, 20, 10 * 60 * 1000), async (req, res) => {
  const deductedIds = [];
  try {
    const { items, total, deliveryType, address, clientName, clientPhone, notes, scheduledDate, scheduledTime, paymentMethod } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "El pedido no tiene productos" });
    }

    const settings = await Settings.findOne();
    if (settings && settings.acceptingOrders === false) {
      return res.status(403).json({ error: "El local esta cerrado y no esta aceptando pedidos en este momento" });
    }

    const stockDeductions = new Map();
    const productPriceMap = new Map();
    const orderLines = [];
    const productsById = new Map();
    for (const item of items) {
      const product = await Product.findById(item._id);
      if (!product) return res.status(400).json({ error: `Producto no encontrado: ${item.name}` });
      if (product.active === false) return res.status(400).json({ error: `Producto no disponible: ${product.name}` });

      const qty = Number(item.qty) || 0;
      if (qty <= 0) return res.status(400).json({ error: `Cantidad invalida para: ${item.name}` });

      productsById.set(product._id.toString(), product);

      if (item._piecesOverride > 0) {
        productPriceMap.set(`combo:${item._id?.toString()}`, { price: getComboPiecePrice(product), qty: Number(item._piecesOverride) * qty });
      } else {
        productPriceMap.set(item._id?.toString(), { price: product.price, qty });
        orderLines.push({ productId: product._id, qty });
      }

      for (const recipeItem of getStockRecipe(product, item)) {
        const id = recipeItem.product.toString();
        const pieces = (Number(recipeItem.pieces) || 0) * qty;
        stockDeductions.set(id, (stockDeductions.get(id) || 0) + pieces);
      }
    }

    const promos = await getActivePromotions();
    const { total: promoTotal, appliedPromoIds } = calculateOrderTotal(orderLines, productsById, promos);

    let calculatedBase = promoTotal;
    for (const [key, { price, qty }] of productPriceMap) {
      if (key.startsWith("combo:")) calculatedBase += price * qty;
    }
    const discount = (paymentMethod === "cash" && settings.cashDiscount > 0)
      ? Math.round(calculatedBase * settings.cashDiscount / 100)
      : 0;
    const calculatedTotal = calculatedBase - discount;
    const submittedTotal = Number(total);
    if (Number.isFinite(submittedTotal) && Math.abs(submittedTotal - calculatedTotal) > 10) {
      return res.status(409).json({ error: "El total cambio. Actualiza el pedido y volve a intentarlo." });
    }

    const stockProducts = await Product.find({ _id: { $in: [...stockDeductions.keys()] } });
    const stockById = new Map(stockProducts.map(p => [p._id.toString(), p]));

    const stockDeductionDetails = [];
    for (const [id, pieces] of stockDeductions) {
      const updated = await Product.findOneAndUpdate(
        { _id: id, stock: { $gte: pieces } },
        { $inc: { stock: -pieces } },
        { new: false }
      );
      if (!updated) {
        await Promise.all(deductedIds.map(({ did, dpieces }) =>
          Product.findByIdAndUpdate(did, { $inc: { stock: dpieces } })
        ));
        const name = stockById.get(id)?.name || id;
        return res.status(400).json({ error: `Stock insuficiente para: ${name}` });
      }
      deductedIds.push({ did: id, dpieces: pieces });
      stockDeductionDetails.push({ product: id, name: updated.name, pieces });
    }

    const settingsUpdated = await Settings.findOneAndUpdate(
      {},
      { $inc: { _orderSeq: 1 } },
      { new: true, upsert: true }
    );
    const orderNumber = settingsUpdated._orderSeq || 1;

    const order = new Order({
      number: orderNumber,
      items,
      total: calculatedTotal,
      appliedPromoIds,
      deliveryType: deliveryType || "retiro",
      address: address || "",
      clientName: clientName || "",
      clientPhone: clientPhone || "",
      notes: notes || "",
      scheduledDate: scheduledDate || "",
      scheduledTime: scheduledTime || "",
      paymentMethod: paymentMethod || "transfer",
      stockDeductions: stockDeductionDetails
    });
    await order.save();

    // Broadcast SSE — se inyecta desde server.js
    if (req.app.locals.broadcast) req.app.locals.broadcast("order_new", order);

    res.json(order);
  } catch (err) {
    if (deductedIds.length) {
      await Promise.all(deductedIds.map(({ did, dpieces }) =>
        Product.findByIdAndUpdate(did, { $inc: { stock: dpieces } })
      )).catch(e => console.error("Error en rollback de stock:", e));
    }
    res.status(400).json({ error: "Error al crear pedido", detalle: err.message });
  }
});

// PUT /orders/:id
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    if (req.app.locals.broadcast) req.app.locals.broadcast("order_updated", o);
    res.json(o);
  } catch (err) { res.status(400).json({ error: "Error al actualizar pedido", detalle: err.message }); }
});

// DELETE /orders/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const o = await Order.findByIdAndDelete(req.params.id);
    if (!o) return res.status(404).json({ error: "Pedido no encontrado" });
    if (Array.isArray(o.stockDeductions) && o.stockDeductions.length) {
      await Promise.all(o.stockDeductions.map(d =>
        Product.findByIdAndUpdate(d.product, { $inc: { stock: d.pieces } })
      ));
    }
    if (req.app.locals.broadcast) req.app.locals.broadcast("order_deleted", { _id: o._id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar pedido" }); }
});

module.exports = router;
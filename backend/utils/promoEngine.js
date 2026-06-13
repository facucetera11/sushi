const Promotion = require("../models/Promotion");

function isPromoLive(promo) {
  if (!promo.active) return false;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (promo.startDate && today < promo.startDate) return false;
  if (promo.endDate && today > promo.endDate) return false;
  return true;
}

async function getActivePromotions() {
  const promos = await Promotion.find({ active: true });
  return promos.filter(isPromoLive);
}

// Devuelve la mejor promo aplicable a un producto (la que más ahorro genera para 1 unidad,
// usada solo para mostrar el badge; el cálculo real de carrito es por línea/cantidad)
function getPromoForProduct(product, promos) {
  const candidates = promos.filter(promo => {
    if (promo.scope === "products") {
      return promo.productIds.some(id => id.toString() === product._id.toString());
    }
    if (promo.scope === "categories") {
      return promo.categories.includes(product.category);
    }
    return false;
  });
  if (!candidates.length) return null;

  // Prioridad simple: bundle > 2x1 > fixed_price > percent, y entre iguales, mayor ahorro
  const priority = { bundle: 4, "2x1": 3, fixed_price: 2, percent: 1 };
  candidates.sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));
  return candidates[0];
}

// Calcula el precio efectivo por unidad / total para una línea de carrito dada
// product: doc de Product, qty: cantidad pedida, promos: lista de promos activas
// Devuelve { unitPrice, lineTotal, appliedPromo }
function applyPromoToLine(product, qty, promos) {
  const basePrice = Number(product.price) || 0;
  const baseTotal = basePrice * qty;
  const promo = getPromoForProduct(product, promos);

  if (!promo) return { lineTotal: baseTotal, appliedPromo: null };

  let lineTotal = baseTotal;

  switch (promo.type) {
    case "percent": {
      const pct = Math.min(100, Math.max(0, Number(promo.value) || 0));
      lineTotal = Math.round(baseTotal * (1 - pct / 100));
      break;
    }
    case "2x1": {
      // Cada par de unidades: se paga 1
      const payableUnits = Math.ceil(qty / 2);
      lineTotal = payableUnits * basePrice;
      break;
    }
    case "fixed_price": {
      // Cada "quantity" unidades cuestan "value" en total
      const groupSize = Math.max(1, Number(promo.quantity) || 2);
      const groupPrice = Number(promo.value) || basePrice * groupSize;
      const fullGroups = Math.floor(qty / groupSize);
      const remainder = qty % groupSize;
      lineTotal = fullGroups * groupPrice + remainder * basePrice;
      break;
    }
    case "bundle": {
      // El bundle se resuelve a nivel de pedido completo (ver applyBundlePromos), no por línea
      lineTotal = baseTotal;
      break;
    }
  }

  return { lineTotal, appliedPromo: promo };
}

// Calcula el total de un conjunto de líneas {productId, qty, price} aplicando promos
// productsMap: Map<id, ProductDoc>
function calculateOrderTotal(lines, productsMap, promos) {
  let total = 0;
  const appliedPromos = new Set();

  for (const line of lines) {
    const product = productsMap.get(line.productId.toString());
    if (!product) {
      total += (line.price || 0) * line.qty;
      continue;
    }
    const { lineTotal, appliedPromo } = applyPromoToLine(product, line.qty, promos);
    total += lineTotal;
    if (appliedPromo) appliedPromos.add(appliedPromo._id.toString());
  }

  // Bundles: si están TODOS los productos del bundle presentes (al menos 1 c/u),
  // se reemplaza la suma de esos productos (a precio normal, 1 unidad c/u) por el precio del bundle,
  // y el resto de unidades de esos productos se cobran a precio normal.
  for (const promo of promos.filter(p => p.type === "bundle")) {
    const ids = promo.productIds.map(id => id.toString());
    const lineByProduct = new Map(lines.map(l => [l.productId.toString(), l]));
    const allPresent = ids.every(id => lineByProduct.has(id) && lineByProduct.get(id).qty >= 1);
    if (!allPresent) continue;

    let normalSumOneEach = 0;
    for (const id of ids) {
      const product = productsMap.get(id);
      if (product) normalSumOneEach += Number(product.price) || 0;
    }
    const savings = normalSumOneEach - (Number(promo.value) || 0);
    if (savings > 0) {
      total -= savings;
      appliedPromos.add(promo._id.toString());
    }
  }

  return { total: Math.max(0, Math.round(total)), appliedPromoIds: [...appliedPromos] };
}

module.exports = {
  getActivePromotions,
  getPromoForProduct,
  applyPromoToLine,
  calculateOrderTotal,
  isPromoLive
};

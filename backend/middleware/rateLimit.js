function rateLimit(store, limit, windowMs) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const current = store.get(key) || { count: 0, resetAt: now + windowMs };
    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }
    current.count += 1;
    store.set(key, current);
    if (current.count > limit) {
      return res.status(429).json({ error: "Demasiados intentos. Proba de nuevo en unos minutos." });
    }
    next();
  };
}

module.exports = rateLimit;

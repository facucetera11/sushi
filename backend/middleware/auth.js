const crypto = require("crypto");
const Settings = require("../models/Settings");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signTokenPayload(payload) {
  const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET o ADMIN_PASSWORD no configurado");
  if (!process.env.ADMIN_TOKEN_SECRET) {
    console.warn("⚠️  ADMIN_TOKEN_SECRET no está configurado. Se usa ADMIN_PASSWORD como fallback. Configurar ADMIN_TOKEN_SECRET por separado es más seguro.");
  }
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createToken(version = 0) {
  const payload = base64url({ role: "admin", version, exp: Date.now() + TOKEN_TTL_MS });
  return `${payload}.${signTokenPayload(payload)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = hashPassword(password, salt).hash;
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

async function isAdminPassword(password) {
  const s = await Settings.findOne();
  if (s && s.adminPasswordHash && s.adminPasswordSalt) {
    return verifyPassword(password, s.adminPasswordSalt, s.adminPasswordHash);
  }
  return Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
}

async function requireAdmin(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const queryToken = req.query.token || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : queryToken;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || signature !== signTokenPayload(payload)) {
      return res.status(401).json({ error: "Sesion invalida" });
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const s = await Settings.findOne();
    if (data.role !== "admin" || data.exp < Date.now() || data.version !== (s.adminTokenVersion || 0)) {
      return res.status(401).json({ error: "Sesion vencida" });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: "Sesion invalida" });
  }
}

module.exports = { createToken, hashPassword, isAdminPassword, requireAdmin };

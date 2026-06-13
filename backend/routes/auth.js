const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const rateLimit = require("../middleware/rateLimit");
const { createToken, hashPassword, isAdminPassword, requireAdmin } = require("../middleware/auth");

const authAttempts = new Map();

router.post("/", rateLimit(authAttempts, 8, 15 * 60 * 1000), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Ingresa la contrasena" });
    const s = await Settings.findOne();
    if (await isAdminPassword(password)) {
      return res.json({ ok: true, token: createToken(s.adminTokenVersion || 0) });
    }
    return res.status(401).json({ error: "Contrasena incorrecta" });
  } catch (err) {
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

router.post("/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "La nueva contrasena debe tener al menos 8 caracteres" });
    }
    if (!(await isAdminPassword(currentPassword || ""))) {
      return res.status(400).json({ error: "La contrasena actual no es correcta" });
    }
    const s = await Settings.findOne();
    const { salt, hash } = hashPassword(newPassword);
    s.adminPasswordSalt = salt;
    s.adminPasswordHash = hash;
    s.adminTokenVersion = (s.adminTokenVersion || 0) + 1;
    await s.save();
    res.json({ ok: true, token: createToken(s.adminTokenVersion) });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar contrasena" });
  }
});

module.exports = router;

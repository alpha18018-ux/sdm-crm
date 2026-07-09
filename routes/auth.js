const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { readDB, writeDB } = require("../db");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const db = readDB();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );

  if (!user || !user.active) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const payload = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
  res.json({ token, user: payload });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeDB(db);
  res.json({ message: "Password updated successfully." });
});

module.exports = router;

const express = require("express");
const bcrypt = require("bcryptjs");
const { readDB, writeDB, nextId, nowISO } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// All routes here require admin
router.use(requireAuth, requireRole("admin"));

// List all sales + rider users (not other admins)
router.get("/", (req, res) => {
  const db = readDB();
  const { role } = req.query;

  let users = db.users.filter((u) => u.role !== "admin");
  if (role) users = users.filter((u) => u.role === role);

  const safe = users.map(({ passwordHash, ...rest }) => rest);
  res.json({ users: safe });
});

// Create a sales or rider account
router.post("/", (req, res) => {
  const { username, password, fullName, role } = req.body;

  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: "Username, password, full name and role are required." });
  }
  if (!["sales", "rider"].includes(role)) {
    return res.status(400).json({ error: "Role must be 'sales' or 'rider'." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const db = readDB();
  const exists = db.users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );
  if (exists) {
    return res.status(409).json({ error: "This username is already taken." });
  }

  const user = {
    id: nextId(db, "userId"),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    fullName: fullName.trim(),
    role,
    active: true,
    createdAt: nowISO()
  };

  db.users.push(user);
  writeDB(db);

  const { passwordHash, ...safeUser } = user;
  res.status(201).json({ user: safeUser });
});

// Update a user (full name, role-limited fields, active status, reset password)
router.put("/:id", (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user || user.role === "admin") {
    return res.status(404).json({ error: "User not found." });
  }

  const { fullName, active, newPassword } = req.body;

  if (fullName) user.fullName = fullName.trim();
  if (typeof active === "boolean") user.active = active;
  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
  }

  writeDB(db);
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

// Deactivate (soft delete) a user - keeps order history intact
router.delete("/:id", (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user || user.role === "admin") {
    return res.status(404).json({ error: "User not found." });
  }

  user.active = false;
  writeDB(db);
  res.json({ message: "User deactivated.", user: { id: user.id, active: user.active } });
});

module.exports = router;

const express = require("express");
const { readDB, writeDB, nextId } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Anyone logged in can view stock (sales needs to know what's available)
router.get("/", requireAuth, (req, res) => {
  const db = readDB();
  res.json({ products: db.products });
});

// Only admin can add a new product
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { name, stock } = req.body;
  if (!name) return res.status(400).json({ error: "Product name is required." });

  const db = readDB();
  const product = {
    id: nextId(db, "productId"),
    name: name.trim(),
    stock: Number(stock) || 0
  };
  db.products.push(product);
  writeDB(db);
  res.status(201).json({ product });
});

// Only admin can update stock quantity (set exact value or increment/decrement)
router.put("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const db = readDB();
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found." });

  const { name, stock, adjust } = req.body;

  if (name) product.name = name.trim();
  if (typeof stock === "number") product.stock = Math.max(0, stock);
  if (typeof adjust === "number") product.stock = Math.max(0, product.stock + adjust);

  writeDB(db);
  res.json({ product });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Product not found." });

  db.products.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Product removed." });
});

module.exports = router;

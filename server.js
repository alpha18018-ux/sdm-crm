require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { ensureDB } = require("./db");

ensureDB();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    // always revalidate so phones/browsers don't keep showing stale JS/CSS after updates
    res.setHeader("Cache-Control", "no-cache");
  }
}));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

// fallback to login page for unknown routes (simple SPA-ish behaviour)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => {
  console.log(`SDM CRM server running on http://localhost:${PORT}`);
});

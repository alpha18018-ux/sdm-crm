const express = require("express");
const { readDB } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/admin", requireAuth, requireRole("admin"), (req, res) => {
  const db = readDB();
  const orders = db.orders;

  const byStatus = {};
  orders.forEach((o) => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  const revenue = orders
    .filter((o) => o.status === "Delivered")
    .reduce((sum, o) => sum + (o.price || 0) * o.quantity, 0);

  const riders = db.users.filter((u) => u.role === "rider" && u.active);
  const riderStats = riders.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    assigned: orders.filter((o) => o.assignedRiderId === r.id && !["Delivered", "Cancelled"].includes(o.status)).length,
    delivered: orders.filter((o) => o.assignedRiderId === r.id && o.status === "Delivered").length,
    cancelled: orders.filter((o) => o.assignedRiderId === r.id && o.status === "Cancelled").length
  }));

  const salesUsers = db.users.filter((u) => u.role === "sales" && u.active);
  const salesStats = salesUsers.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    ordersCreated: orders.filter((o) => o.createdBy === s.id).length,
    delivered: orders.filter((o) => o.createdBy === s.id && o.status === "Delivered").length
  }));

  const lowStock = db.products.filter((p) => p.stock <= 10);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  res.json({
    totals: {
      totalOrders: orders.length,
      unassigned: byStatus["Unassigned"] || 0,
      assigned: byStatus["Assigned"] || 0,
      onTheWay: byStatus["On The Way"] || 0,
      delivered: byStatus["Delivered"] || 0,
      cancelled: byStatus["Cancelled"] || 0,
      pending: byStatus["Pending"] || 0,
      revenue
    },
    riderStats,
    salesStats,
    lowStock,
    products: db.products,
    recentOrders
  });
});

router.get("/sales", requireAuth, requireRole("sales"), (req, res) => {
  const db = readDB();
  const mine = db.orders.filter((o) => o.createdBy === req.user.id);

  const byStatus = {};
  mine.forEach((o) => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  res.json({
    totals: {
      totalOrders: mine.length,
      unassigned: byStatus["Unassigned"] || 0,
      assigned: byStatus["Assigned"] || 0,
      onTheWay: byStatus["On The Way"] || 0,
      delivered: byStatus["Delivered"] || 0,
      cancelled: byStatus["Cancelled"] || 0,
      pending: byStatus["Pending"] || 0
    },
    recentOrders: [...mine].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8)
  });
});

router.get("/rider", requireAuth, requireRole("rider"), (req, res) => {
  const db = readDB();
  const mine = db.orders.filter((o) => o.assignedRiderId === req.user.id);

  const byStatus = {};
  mine.forEach((o) => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  res.json({
    totals: {
      totalOrders: mine.length,
      assigned: byStatus["Assigned"] || 0,
      onTheWay: byStatus["On The Way"] || 0,
      delivered: byStatus["Delivered"] || 0,
      cancelled: byStatus["Cancelled"] || 0,
      pending: byStatus["Pending"] || 0
    },
    activeOrders: mine.filter((o) => !["Delivered", "Cancelled"].includes(o.status))
  });
});

module.exports = router;

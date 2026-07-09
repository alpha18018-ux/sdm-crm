const express = require("express");
const { readDB, writeDB, nextId, nextOrderNumber, nowISO } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const STATUS = {
  UNASSIGNED: "Unassigned",   // just created, waiting for admin to assign a rider
  ASSIGNED: "Assigned",       // admin gave it to a rider, rider hasn't left yet
  ON_THE_WAY: "On The Way",   // rider marked it as out for delivery
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  PENDING: "Pending"          // rider tried but could not deliver, needs re-attempt
};

function addHistory(order, status, byUser) {
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    status,
    at: nowISO(),
    by: byUser ? `${byUser.fullName} (${byUser.role})` : "system"
  });
}

function buildMapsLink(customerMapsLink, lat, lng, address) {
  if (customerMapsLink && customerMapsLink.trim()) return customerMapsLink.trim();
  if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
}

// GET /api/orders - role based visibility
router.get("/", requireAuth, (req, res) => {
  const db = readDB();
  let orders = db.orders;

  if (req.user.role === "sales") {
    orders = orders.filter((o) => o.createdBy === req.user.id);
  } else if (req.user.role === "rider") {
    orders = orders.filter((o) => o.assignedRiderId === req.user.id);
  }
  // admin sees everything

  const { status, riderId, salesId } = req.query;
  if (status) orders = orders.filter((o) => o.status === status);
  if (riderId) orders = orders.filter((o) => o.assignedRiderId === Number(riderId));
  if (salesId) orders = orders.filter((o) => o.createdBy === Number(salesId));

  orders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ orders });
});

router.get("/:id", requireAuth, (req, res) => {
  const db = readDB();
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found." });

  if (
    (req.user.role === "sales" && order.createdBy !== req.user.id) ||
    (req.user.role === "rider" && order.assignedRiderId !== req.user.id)
  ) {
    return res.status(403).json({ error: "You cannot view this order." });
  }

  res.json({ order });
});

// POST /api/orders - admin or sales creates an order
router.post("/", requireAuth, requireRole("admin", "sales"), (req, res) => {
  const {
    customerName,
    customerPhone,
    productId,
    quantity,
    price,
    address,
    lat,
    lng,
    customerMapsLink,
    notes,
    assignRiderId // admin may optionally assign immediately
  } = req.body;

  if (!customerName || !customerPhone || !productId || !quantity || !address) {
    return res.status(400).json({
      error: "Customer name, phone, product, quantity and location/address are required."
    });
  }

  const db = readDB();
  const product = db.products.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: "Product not found." });

  const qty = Number(quantity);
  if (qty <= 0) return res.status(400).json({ error: "Quantity must be at least 1." });
  if (product.stock < qty) {
    return res.status(400).json({ error: `Not enough stock. Only ${product.stock} left for ${product.name}.` });
  }

  let riderUser = null;
  if (assignRiderId && req.user.role === "admin") {
    riderUser = db.users.find((u) => u.id === Number(assignRiderId) && u.role === "rider" && u.active);
    if (!riderUser) return res.status(404).json({ error: "Selected rider not found." });
  }

  // reserve stock immediately
  product.stock -= qty;

  const order = {
    id: nextId(db, "orderId"),
    orderNumber: nextOrderNumber(db),
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    productId: product.id,
    productName: product.name,
    quantity: qty,
    price: price ? Number(price) : 0,
    address: address.trim(),
    lat: lat || null,
    lng: lng || null,
    customerMapsLink: customerMapsLink ? customerMapsLink.trim() : "",
    mapsLink: buildMapsLink(customerMapsLink, lat, lng, address),
    notes: notes ? notes.trim() : "",
    status: riderUser ? STATUS.ASSIGNED : STATUS.UNASSIGNED,
    createdBy: req.user.id,
    createdByName: req.user.fullName,
    assignedRiderId: riderUser ? riderUser.id : null,
    assignedRiderName: riderUser ? riderUser.fullName : null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    statusHistory: []
  };

  addHistory(order, order.status, req.user);
  db.orders.push(order);
  writeDB(db);

  res.status(201).json({ order });
});

// PUT /api/orders/:id - edit order details
router.put("/:id", requireAuth, requireRole("admin", "sales"), (req, res) => {
  const db = readDB();
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found." });

  if (req.user.role === "sales") {
    if (order.createdBy !== req.user.id) {
      return res.status(403).json({ error: "You can only edit orders you created." });
    }
    if (order.status !== STATUS.UNASSIGNED) {
      return res.status(400).json({ error: "This order has already been assigned/processed and can no longer be edited by sales. Ask admin." });
    }
  }

  const {
    customerName,
    customerPhone,
    productId,
    quantity,
    price,
    address,
    lat,
    lng,
    customerMapsLink,
    notes
  } = req.body;

  // handle stock adjustment if product or quantity changed
  if (productId || quantity) {
    const newProduct = productId ? db.products.find((p) => p.id === Number(productId)) : db.products.find((p) => p.id === order.productId);
    if (!newProduct) return res.status(404).json({ error: "Product not found." });

    const oldProduct = db.products.find((p) => p.id === order.productId);
    const newQty = quantity ? Number(quantity) : order.quantity;

    if (newProduct.id === order.productId) {
      // same product, adjust the difference
      const diff = newQty - order.quantity;
      if (diff > 0 && newProduct.stock < diff) {
        return res.status(400).json({ error: `Not enough stock. Only ${newProduct.stock} left for ${newProduct.name}.` });
      }
      newProduct.stock -= diff;
    } else {
      // product changed - refund old, reserve new
      if (newProduct.stock < newQty) {
        return res.status(400).json({ error: `Not enough stock. Only ${newProduct.stock} left for ${newProduct.name}.` });
      }
      oldProduct.stock += order.quantity;
      newProduct.stock -= newQty;
      order.productId = newProduct.id;
      order.productName = newProduct.name;
    }
    order.quantity = newQty;
  }

  if (customerName) order.customerName = customerName.trim();
  if (customerPhone) order.customerPhone = customerPhone.trim();
  if (typeof price === "number" || price === 0) order.price = Number(price);
  if (address) order.address = address.trim();
  if (lat !== undefined) order.lat = lat;
  if (lng !== undefined) order.lng = lng;
  if (customerMapsLink !== undefined) order.customerMapsLink = customerMapsLink.trim();
  if (address || lat !== undefined || lng !== undefined || customerMapsLink !== undefined) {
    order.mapsLink = buildMapsLink(order.customerMapsLink, order.lat, order.lng, order.address);
  }
  if (notes !== undefined) order.notes = notes.trim();

  order.updatedAt = nowISO();
  writeDB(db);
  res.json({ order });
});

// DELETE /api/orders/:id
router.delete("/:id", requireAuth, requireRole("admin", "sales"), (req, res) => {
  const db = readDB();
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found." });

  if (req.user.role === "sales") {
    if (order.createdBy !== req.user.id) {
      return res.status(403).json({ error: "You can only delete orders you created." });
    }
    if (order.status !== STATUS.UNASSIGNED) {
      return res.status(400).json({ error: "This order has already been assigned/processed and can no longer be deleted by sales. Ask admin." });
    }
  }

  // restock unless it was already delivered (stock genuinely left the warehouse)
  if (order.status !== STATUS.DELIVERED) {
    const product = db.products.find((p) => p.id === order.productId);
    if (product) product.stock += order.quantity;
  }

  db.orders = db.orders.filter((o) => o.id !== order.id);
  writeDB(db);
  res.json({ message: "Order deleted." });
});

// PATCH /api/orders/:id/assign - admin assigns/reassigns a rider
router.patch("/:id/assign", requireAuth, requireRole("admin"), (req, res) => {
  const { riderId } = req.body;
  if (!riderId) return res.status(400).json({ error: "riderId is required." });

  const db = readDB();
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found." });

  const rider = db.users.find((u) => u.id === Number(riderId) && u.role === "rider" && u.active);
  if (!rider) return res.status(404).json({ error: "Rider not found." });

  if ([STATUS.DELIVERED, STATUS.CANCELLED].includes(order.status)) {
    return res.status(400).json({ error: `Cannot reassign a ${order.status.toLowerCase()} order.` });
  }

  order.assignedRiderId = rider.id;
  order.assignedRiderName = rider.fullName;
  order.status = STATUS.ASSIGNED;
  order.updatedAt = nowISO();
  addHistory(order, `Assigned to ${rider.fullName}`, req.user);

  writeDB(db);
  res.json({ order });
});

// PATCH /api/orders/:id/status - rider updates delivery status, admin can override to any status
const RIDER_ALLOWED_TRANSITIONS = {
  [STATUS.ASSIGNED]: [STATUS.ON_THE_WAY],
  [STATUS.ON_THE_WAY]: [STATUS.DELIVERED, STATUS.CANCELLED, STATUS.PENDING],
  [STATUS.PENDING]: [STATUS.ON_THE_WAY, STATUS.DELIVERED, STATUS.CANCELLED]
};

router.patch("/:id/status", requireAuth, requireRole("admin", "rider"), (req, res) => {
  const { status } = req.body;
  if (!status || !Object.values(STATUS).includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const db = readDB();
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found." });

  if (req.user.role === "rider") {
    if (order.assignedRiderId !== req.user.id) {
      return res.status(403).json({ error: "This order is not assigned to you." });
    }
    const allowed = RIDER_ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot change status from ${order.status} to ${status}.` });
    }
  }

  const previousStatus = order.status;
  order.status = status;
  order.updatedAt = nowISO();
  addHistory(order, status, req.user);

  // stock handling on cancellation / restore
  if (status === STATUS.CANCELLED && previousStatus !== STATUS.CANCELLED) {
    const product = db.products.find((p) => p.id === order.productId);
    if (product) product.stock += order.quantity;
  }
  if (previousStatus === STATUS.CANCELLED && status !== STATUS.CANCELLED) {
    const product = db.products.find((p) => p.id === order.productId);
    if (product) {
      if (product.stock < order.quantity) {
        // not enough stock to un-cancel, revert
        order.status = STATUS.CANCELLED;
        return res.status(400).json({ error: "Cannot reactivate order, not enough stock left." });
      }
      product.stock -= order.quantity;
    }
  }

  writeDB(db);
  res.json({ order });
});

module.exports = router;
module.exports.STATUS = STATUS;

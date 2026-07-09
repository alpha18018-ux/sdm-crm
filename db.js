// db.js
// Lightweight file-based database (no native modules needed -> deploys anywhere).
// For a small internal CRM (1 admin, 5 sales, 3 riders) this is more than enough.
// If the company grows a lot later, this same file can be swapped for a real
// database (Postgres/MySQL) without changing the routes much, because all
// reads/writes go through the functions below.

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_FILE = path.join(__dirname, "data", "db.json");

const DEFAULT_PRODUCTS = [
  { name: "Men's Oil" },
  { name: "Belly Oil" },
  { name: "Face Serum" },
  { name: "Hair Oil" },
  { name: "Kinoki Patches" },
  { name: "Ring" }
];

function nowISO() {
  return new Date().toISOString();
}

function ensureDB() {
  if (!fs.existsSync(path.join(__dirname, "data"))) {
    fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

    const initialData = {
      users: [
        {
          id: 1,
          username: adminUsername,
          passwordHash: bcrypt.hashSync(adminPassword, 10),
          fullName: "Administrator",
          role: "admin",
          active: true,
          createdAt: nowISO()
        }
      ],
      products: DEFAULT_PRODUCTS.map((p, i) => ({
        id: i + 1,
        name: p.name,
        stock: 100
      })),
      orders: [],
      counters: {
        userId: 1,
        productId: DEFAULT_PRODUCTS.length,
        orderId: 0,
        orderNumber: 0
      }
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    console.log("Created new database with default admin account:");
    console.log(`   username: ${adminUsername}`);
    console.log(`   password: ${adminPassword}`);
    console.log("Please log in and change this password immediately.");
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(db, counterKey) {
  db.counters[counterKey] = (db.counters[counterKey] || 0) + 1;
  return db.counters[counterKey];
}

function nextOrderNumber(db) {
  db.counters.orderNumber = (db.counters.orderNumber || 0) + 1;
  const num = db.counters.orderNumber.toString().padStart(6, "0");
  return `SDM-${num}`;
}

module.exports = { readDB, writeDB, nextId, nextOrderNumber, nowISO, ensureDB };

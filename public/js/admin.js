const user = guard("admin");
document.getElementById("sidebarHolder").outerHTML = renderSidebar("admin", "dashboard");

let PRODUCTS = [];
let RIDERS = [];
let SALES = [];

// ---------- section routing (hash based) ----------
function showSection() {
  const hash = location.hash.replace("#", "") || "dashboard";
  ["dashboard", "orders", "users", "stock"].forEach((k) => {
    document.getElementById("sec-" + k).style.display = k === hash ? "" : "none";
    const link = document.querySelector(`.nav-link[data-key="${k}"]`);
    if (link) link.classList.toggle("active", k === hash);
  });
  if (hash === "dashboard") loadDashboard();
  if (hash === "orders") loadOrders();
  if (hash === "users") loadUsers();
  if (hash === "stock") loadStock();
}
window.addEventListener("hashchange", showSection);

// ---------- initial load ----------
(async function init() {
  await Promise.all([loadProductsList(), loadRidersAndSales()]);
  showSection();
})();

async function loadProductsList() {
  const data = await api("/products");
  PRODUCTS = data.products;
  const sel = document.getElementById("productId");
  sel.innerHTML = PRODUCTS.map((p) => `<option value="${p.id}">${p.name} (${p.stock} in stock)</option>`).join("");
}

async function loadRidersAndSales() {
  const [r, s] = await Promise.all([api("/users?role=rider"), api("/users?role=sales")]);
  RIDERS = r.users.filter((u) => u.active);
  SALES = s.users;
  const opts = `<option value="">Not assigned yet</option>` + RIDERS.map((r) => `<option value="${r.id}">${r.fullName}</option>`).join("");
  document.getElementById("assignRiderId").innerHTML = opts;
  document.getElementById("filterRider").innerHTML = `<option value="">All riders</option>` + RIDERS.map((r) => `<option value="${r.id}">${r.fullName}</option>`).join("");
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  const d = await api("/dashboard/admin");
  const t = d.totals;
  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${t.totalOrders}</div></div>
    <div class="stat-card"><div class="stat-label">Unassigned</div><div class="stat-value" style="color:var(--warning)">${t.unassigned}</div></div>
    <div class="stat-card"><div class="stat-label">On The Way</div><div class="stat-value" style="color:#5b3fc4">${t.onTheWay}</div></div>
    <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value" style="color:var(--success)">${t.delivered}</div></div>
    <div class="stat-card"><div class="stat-label">Cancelled</div><div class="stat-value" style="color:var(--danger)">${t.cancelled}</div></div>
    <div class="stat-card"><div class="stat-label">Revenue (Delivered)</div><div class="stat-value mono">Rs. ${t.revenue.toLocaleString()}</div></div>
  `;

  document.getElementById("riderStatsBody").innerHTML = d.riderStats.map((r) => `
    <tr><td>${r.fullName}</td><td>${r.assigned}</td><td>${r.delivered}</td><td>${r.cancelled}</td></tr>
  `).join("") || `<tr><td colspan="4" class="empty-state">No riders yet</td></tr>`;

  document.getElementById("salesStatsBody").innerHTML = d.salesStats.map((s) => `
    <tr><td>${s.fullName}</td><td>${s.ordersCreated}</td><td>${s.delivered}</td></tr>
  `).join("") || `<tr><td colspan="3" class="empty-state">No sales team yet</td></tr>`;

  document.getElementById("recentOrdersBody").innerHTML = d.recentOrders.map((o) => `
    <tr>
      <td class="order-no">${o.orderNumber}</td><td>${o.customerName}</td><td>${o.productName}</td>
      <td><span class="badge ${badgeClass(o.status)}">${o.status}</span></td><td>${fmtDate(o.createdAt)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="empty-state">No orders yet</td></tr>`;
}

// ---------- ORDERS ----------
async function loadOrders() {
  const status = document.getElementById("filterStatus")?.value;
  const riderId = document.getElementById("filterRider")?.value;
  const search = (document.getElementById("searchBox")?.value || "").toLowerCase();

  let q = [];
  if (status) q.push(`status=${encodeURIComponent(status)}`);
  if (riderId) q.push(`riderId=${riderId}`);
  const data = await api("/orders" + (q.length ? "?" + q.join("&") : ""));

  let orders = data.orders;
  if (search) {
    orders = orders.filter((o) => o.customerName.toLowerCase().includes(search) || o.orderNumber.toLowerCase().includes(search));
  }

  document.getElementById("ordersBody").innerHTML = orders.map((o) => `
    <tr>
      <td class="order-no">${o.orderNumber}</td>
      <td>${o.customerName}<br><span class="hint">${o.customerPhone}</span></td>
      <td>${o.productName} &times;${o.quantity}</td>
      <td>${o.quantity}</td>
      <td>${o.mapsLink ? `<a class="map-link" target="_blank" href="${o.mapsLink}">&#128205; View map</a>` : o.address}</td>
      <td><span class="badge ${badgeClass(o.status)}">${o.status}</span></td>
      <td>${o.assignedRiderName || "-"}</td>
      <td>${o.createdByName}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick='openAssignModal(${o.id})'>Assign</button>
          <button class="btn btn-outline btn-sm" onclick='editOrder(${o.id})'>Edit</button>
          <button class="btn btn-danger btn-sm" onclick='deleteOrder(${o.id})'>Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="9" class="empty-state">No orders match your filters</td></tr>`;
}

let currentAssignOrderId = null;
function openAssignModal(orderId) {
  currentAssignOrderId = orderId;
  document.getElementById("assignRiderSelect").innerHTML = RIDERS.map((r) => `<option value="${r.id}">${r.fullName}</option>`).join("");
  document.getElementById("assignOverlay").classList.add("open");
}
function closeAssignModal() { document.getElementById("assignOverlay").classList.remove("open"); }
async function submitAssign() {
  const riderId = document.getElementById("assignRiderSelect").value;
  try {
    await api(`/orders/${currentAssignOrderId}/assign`, { method: "PATCH", body: JSON.stringify({ riderId }) });
    toast("Rider assigned successfully.");
    closeAssignModal();
    loadOrders();
    loadDashboard();
  } catch (e) { toast(e.message, "error"); }
}

async function deleteOrder(id) {
  if (!confirm("Delete this order? This cannot be undone.")) return;
  try {
    await api(`/orders/${id}`, { method: "DELETE" });
    toast("Order deleted.");
    loadOrders();
    loadProductsList();
  } catch (e) { toast(e.message, "error"); }
}

async function editOrder(id) {
  const data = await api(`/orders/${id}`);
  const o = data.order;
  document.getElementById("orderModalTitle").textContent = `Edit Order ${o.orderNumber}`;
  document.getElementById("orderId").value = o.id;
  document.getElementById("customerName").value = o.customerName;
  document.getElementById("customerPhone").value = o.customerPhone;
  document.getElementById("productId").value = o.productId;
  document.getElementById("quantity").value = o.quantity;
  document.getElementById("price").value = o.price;
  document.getElementById("assignRiderId").value = o.assignedRiderId || "";
  document.getElementById("address").value = o.address;
  document.getElementById("notes").value = o.notes || "";
  document.getElementById("customerMapsLink").value = o.customerMapsLink || "";
  document.getElementById("orderOverlay").classList.add("open");
}

function openOrderModal() {
  document.getElementById("orderForm").reset();
  document.getElementById("orderId").value = "";
  document.getElementById("orderModalTitle").textContent = "New Order";
  document.getElementById("orderOverlay").classList.add("open");
}
function closeOrderModal() { document.getElementById("orderOverlay").classList.remove("open"); }

document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("orderId").value;
  const payload = {
    customerName: document.getElementById("customerName").value,
    customerPhone: document.getElementById("customerPhone").value,
    productId: document.getElementById("productId").value,
    quantity: document.getElementById("quantity").value,
    price: Number(document.getElementById("price").value),
    address: document.getElementById("address").value,
    customerMapsLink: document.getElementById("customerMapsLink").value,
    notes: document.getElementById("notes").value,
    assignRiderId: document.getElementById("assignRiderId").value || undefined
  };
  try {
    if (id) {
      await api(`/orders/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      toast("Order updated.");
    } else {
      await api("/orders", { method: "POST", body: JSON.stringify(payload) });
      toast("Order created.");
    }
    closeOrderModal();
    loadOrders();
    loadDashboard();
    loadProductsList();
  } catch (err) { toast(err.message, "error"); }
});

// ---------- TEAM / USERS ----------
async function loadUsers() {
  await loadRidersAndSales();
  const sales = await api("/users?role=sales");
  const riders = await api("/users?role=rider");

  const row = (u) => `
    <tr>
      <td>${u.fullName}</td><td>${u.username}</td>
      <td><span class="badge ${u.active ? "badge-delivered" : "badge-cancelled"}">${u.active ? "Active" : "Disabled"}</span></td>
      <td>${fmtDate(u.createdAt)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='resetPassword(${u.id})'>Reset password</button>
        <button class="btn ${u.active ? "btn-danger" : "btn-outline"} btn-sm" onclick='toggleActive(${u.id}, ${!u.active})'>${u.active ? "Disable" : "Enable"}</button>
      </td>
    </tr>`;

  document.getElementById("salesUsersBody").innerHTML = sales.users.map(row).join("") || `<tr><td colspan="5" class="empty-state">No sales team members yet</td></tr>`;
  document.getElementById("riderUsersBody").innerHTML = riders.users.map(row).join("") || `<tr><td colspan="5" class="empty-state">No riders yet</td></tr>`;
}

function openUserModal() { document.getElementById("userForm").reset(); document.getElementById("userOverlay").classList.add("open"); }
function closeUserModal() { document.getElementById("userOverlay").classList.remove("open"); }

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    fullName: document.getElementById("uFullName").value,
    username: document.getElementById("uUsername").value,
    password: document.getElementById("uPassword").value,
    role: document.getElementById("uRole").value
  };
  try {
    await api("/users", { method: "POST", body: JSON.stringify(payload) });
    toast("Account created.");
    closeUserModal();
    loadUsers();
  } catch (err) { toast(err.message, "error"); }
});

async function toggleActive(id, active) {
  try {
    await api(`/users/${id}`, { method: "PUT", body: JSON.stringify({ active }) });
    toast(active ? "Account enabled." : "Account disabled.");
    loadUsers();
  } catch (e) { toast(e.message, "error"); }
}

async function resetPassword(id) {
  const pw = prompt("Enter a new password for this user (min 6 characters):");
  if (!pw) return;
  try {
    await api(`/users/${id}`, { method: "PUT", body: JSON.stringify({ newPassword: pw }) });
    toast("Password reset.");
  } catch (e) { toast(e.message, "error"); }
}

// ---------- STOCK ----------
async function loadStock() {
  const data = await api("/products");
  document.getElementById("stockGrid").innerHTML = data.products.map((p) => `
    <div class="stat-card">
      <div class="stat-label">${p.name}</div>
      <div class="stat-value ${p.stock <= 10 ? "low-stock-tag" : ""}">${p.stock} units</div>
      <div style="display:flex;gap:6px;margin-top:12px;">
        <button class="btn btn-outline btn-sm" onclick="adjustStock(${p.id}, 10)">+10</button>
        <button class="btn btn-outline btn-sm" onclick="adjustStock(${p.id}, -10)">-10</button>
        <button class="btn btn-outline btn-sm" onclick="setStock(${p.id})">Set exact</button>
      </div>
    </div>
  `).join("");
}
async function adjustStock(id, adjust) {
  try { await api(`/products/${id}`, { method: "PUT", body: JSON.stringify({ adjust }) }); loadStock(); loadProductsList(); }
  catch (e) { toast(e.message, "error"); }
}
async function setStock(id) {
  const val = prompt("Set exact stock quantity:");
  if (val === null || isNaN(Number(val))) return;
  try { await api(`/products/${id}`, { method: "PUT", body: JSON.stringify({ stock: Number(val) }) }); loadStock(); loadProductsList(); toast("Stock updated."); }
  catch (e) { toast(e.message, "error"); }
}

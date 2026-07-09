const user = guard("sales");
document.getElementById("sidebarHolder").outerHTML = renderSidebar("sales", "dashboard");

let PRODUCTS = [];
let capturedLat = null, capturedLng = null;

function showSection() {
  const hash = location.hash.replace("#", "") || "dashboard";
  ["dashboard", "orders"].forEach((k) => {
    document.getElementById("sec-" + k).style.display = k === hash ? "" : "none";
    const link = document.querySelector(`.nav-link[data-key="${k}"]`);
    if (link) link.classList.toggle("active", k === hash);
  });
  if (hash === "dashboard") loadDashboard();
  if (hash === "orders") loadOrders();
}
window.addEventListener("hashchange", showSection);

(async function init() {
  await loadProductsList();
  showSection();
})();

async function loadProductsList() {
  const data = await api("/products");
  PRODUCTS = data.products;
  document.getElementById("productId").innerHTML = PRODUCTS.map((p) => `<option value="${p.id}">${p.name} (${p.stock} in stock)</option>`).join("");
}

async function loadDashboard() {
  const d = await api("/dashboard/sales");
  const t = d.totals;
  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${t.totalOrders}</div></div>
    <div class="stat-card"><div class="stat-label">Unassigned</div><div class="stat-value" style="color:var(--warning)">${t.unassigned}</div></div>
    <div class="stat-card"><div class="stat-label">On The Way</div><div class="stat-value" style="color:#5b3fc4">${t.onTheWay}</div></div>
    <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value" style="color:var(--success)">${t.delivered}</div></div>
    <div class="stat-card"><div class="stat-label">Cancelled</div><div class="stat-value" style="color:var(--danger)">${t.cancelled}</div></div>
    <div class="stat-card"><div class="stat-label">Pending re-attempt</div><div class="stat-value" style="color:var(--warning)">${t.pending}</div></div>
  `;
  document.getElementById("recentOrdersBody").innerHTML = d.recentOrders.map((o) => `
    <tr><td class="order-no">${o.orderNumber}</td><td>${o.customerName}</td><td>${o.productName}</td>
    <td><span class="badge ${badgeClass(o.status)}">${o.status}</span></td><td>${fmtDate(o.createdAt)}</td></tr>
  `).join("") || `<tr><td colspan="5" class="empty-state">You haven't created any orders yet</td></tr>`;
}

async function loadOrders() {
  const status = document.getElementById("filterStatus")?.value;
  const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
  const data = await api("/orders" + (status ? `?status=${encodeURIComponent(status)}` : ""));
  let orders = data.orders;
  if (search) orders = orders.filter((o) => o.customerName.toLowerCase().includes(search) || o.orderNumber.toLowerCase().includes(search));

  document.getElementById("ordersBody").innerHTML = orders.map((o) => `
    <tr>
      <td class="order-no">${o.orderNumber}</td>
      <td>${o.customerName}<br><span class="hint">${o.customerPhone}</span></td>
      <td>${o.productName} &times;${o.quantity}</td>
      <td>${o.mapsLink ? `<a class="map-link" target="_blank" href="${o.mapsLink}">&#128205; View map</a>` : o.address}</td>
      <td><span class="badge ${badgeClass(o.status)}">${o.status}</span></td>
      <td>${o.assignedRiderName || "-"}</td>
      <td>
        ${o.status === "Unassigned" ? `
          <button class="btn btn-outline btn-sm" onclick='editOrder(${o.id})'>Edit</button>
          <button class="btn btn-danger btn-sm" onclick='deleteOrder(${o.id})'>Delete</button>
        ` : `<span class="hint">Locked (assigned)</span>`}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="empty-state">No orders match your filters</td></tr>`;
}

async function deleteOrder(id) {
  if (!confirm("Delete this order?")) return;
  try { await api(`/orders/${id}`, { method: "DELETE" }); toast("Order deleted."); loadOrders(); loadProductsList(); }
  catch (e) { toast(e.message, "error"); }
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
  document.getElementById("address").value = o.address;
  document.getElementById("notes").value = o.notes || "";
  capturedLat = o.lat; capturedLng = o.lng;
  document.getElementById("locHint").textContent = o.lat ? `Coordinates saved: ${o.lat}, ${o.lng}` : "No coordinates captured yet.";
  document.getElementById("orderOverlay").classList.add("open");
}

function openOrderModal() {
  document.getElementById("orderForm").reset();
  document.getElementById("orderId").value = "";
  document.getElementById("orderModalTitle").textContent = "New Order";
  capturedLat = null; capturedLng = null;
  document.getElementById("locHint").textContent = "No coordinates captured yet.";
  document.getElementById("orderOverlay").classList.add("open");
}
function closeOrderModal() { document.getElementById("orderOverlay").classList.remove("open"); }

function captureLocation() {
  if (!navigator.geolocation) { toast("Geolocation not supported.", "error"); return; }
  document.getElementById("locHint").textContent = "Getting location...";
  navigator.geolocation.getCurrentPosition((pos) => {
    capturedLat = pos.coords.latitude;
    capturedLng = pos.coords.longitude;
    document.getElementById("locHint").textContent = `Coordinates captured: ${capturedLat.toFixed(5)}, ${capturedLng.toFixed(5)}`;
    toast("Location captured.");
  }, () => { document.getElementById("locHint").textContent = "Could not get location. Type the address manually."; });
}

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
    lat: capturedLat, lng: capturedLng,
    notes: document.getElementById("notes").value
  };
  try {
    if (id) { await api(`/orders/${id}`, { method: "PUT", body: JSON.stringify(payload) }); toast("Order updated."); }
    else { await api("/orders", { method: "POST", body: JSON.stringify(payload) }); toast("Order created."); }
    closeOrderModal(); loadOrders(); loadDashboard(); loadProductsList();
  } catch (err) { toast(err.message, "error"); }
});

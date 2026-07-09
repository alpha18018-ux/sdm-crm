const user = guard("rider");
document.getElementById("sidebarHolder").outerHTML = renderSidebar("rider", "dashboard");

const NEXT_ACTIONS = {
  "Assigned": [{ label: "Start Delivery (On The Way)", status: "On The Way", cls: "btn-primary" }],
  "On The Way": [
    { label: "Mark Delivered", status: "Delivered", cls: "btn-primary" },
    { label: "Mark Pending (retry later)", status: "Pending", cls: "btn-outline" },
    { label: "Mark Cancelled", status: "Cancelled", cls: "btn-danger" }
  ],
  "Pending": [
    { label: "Start Delivery Again", status: "On The Way", cls: "btn-primary" },
    { label: "Mark Delivered", status: "Delivered", cls: "btn-outline" },
    { label: "Mark Cancelled", status: "Cancelled", cls: "btn-danger" }
  ]
};

async function load() {
  const d = await api("/dashboard/rider");
  const t = d.totals;
  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Assigned</div><div class="stat-value">${t.totalOrders}</div></div>
    <div class="stat-card"><div class="stat-label">On The Way</div><div class="stat-value" style="color:#5b3fc4">${t.onTheWay}</div></div>
    <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value" style="color:var(--success)">${t.delivered}</div></div>
    <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value" style="color:var(--warning)">${t.pending}</div></div>
    <div class="stat-card"><div class="stat-label">Cancelled</div><div class="stat-value" style="color:var(--danger)">${t.cancelled}</div></div>
  `;

  const active = d.activeOrders;
  document.getElementById("deliveryList").innerHTML = active.length ? active.map((o) => `
    <div class="delivery-card">
      <div class="delivery-top">
        <div>
          <div class="order-no">${o.orderNumber}</div>
          <h3 style="font-size:17px;margin-top:4px;">${o.customerName} &middot; ${o.customerPhone}</h3>
          <div class="hint" style="margin-top:2px;">${o.productName} &times;${o.quantity}${o.price ? ` &middot; Rs. ${o.price * o.quantity}` : ""}</div>
        </div>
        <span class="badge ${badgeClass(o.status)}">${o.status}</span>
      </div>
      ${renderPipeline(o.status)}
      <div style="margin-top:10px;">
        ${o.mapsLink ? `<a class="map-link" target="_blank" href="${o.mapsLink}">&#128205; Open location in Google Maps</a>` : `<span class="hint">${o.address}</span>`}
      </div>
      ${o.notes ? `<div class="hint" style="margin-top:6px;">Note: ${o.notes}</div>` : ""}
      <div class="delivery-actions">
        ${(NEXT_ACTIONS[o.status] || []).map((a) => `<button class="btn ${a.cls} btn-sm" onclick="updateStatus(${o.id}, '${a.status}')">${a.label}</button>`).join("")}
      </div>
    </div>
  `).join("") : `<div class="empty-state"><div class="ic">&#128666;</div>No active deliveries right now. New assignments from admin will show up here.</div>`;
}

async function updateStatus(id, status) {
  try {
    await api(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    toast(`Order marked as ${status}.`);
    load();
  } catch (e) { toast(e.message, "error"); }
}

load();

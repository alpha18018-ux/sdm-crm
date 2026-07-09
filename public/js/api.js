// ==== Shared helpers used by every dashboard ====

const API = "/api";

function getToken() { return localStorage.getItem("sdm_token"); }
function getUser() {
  try { return JSON.parse(localStorage.getItem("sdm_user")); } catch { return null; }
}
function saveSession(token, user) {
  localStorage.setItem("sdm_token", token);
  localStorage.setItem("sdm_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("sdm_token");
  localStorage.removeItem("sdm_user");
}

// Redirects to login if not authenticated, or if role doesn't match this page
function guard(requiredRole) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = "/login.html";
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = `/${user.role}.html`;
    return null;
  }
  return user;
}

async function api(path, options = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch {}

  if (res.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

function toast(message, type = "success") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function logout() {
  clearSession();
  window.location.href = "/login.html";
}

function badgeClass(status) {
  return "badge-" + status.toLowerCase().replace(/\s+/g, "-");
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Renders the signature status pipeline. `status` is current order status.
const PIPELINE_STEPS = ["Unassigned", "Assigned", "On The Way", "Delivered"];
function renderPipeline(status) {
  if (status === "Cancelled") {
    return `<div class="pipeline">
      <div class="step done"><div class="bar"></div><div class="dot"></div><div class="lbl">Created</div></div>
      <div class="step cancelled"><div class="bar"></div><div class="dot"></div><div class="lbl">Cancelled</div></div>
    </div>`;
  }
  const effectiveStatus = status === "Pending" ? "On The Way" : status;
  const currentIdx = PIPELINE_STEPS.indexOf(effectiveStatus);
  return `<div class="pipeline">` + PIPELINE_STEPS.map((step, i) => {
    let cls = "";
    if (i < currentIdx) cls = "done";
    else if (i === currentIdx) cls = status === "Pending" ? "current" : "current done";
    return `<div class="step ${cls}"><div class="bar"></div><div class="dot"></div><div class="lbl">${step === "Unassigned" ? "Created" : step}</div></div>`;
  }).join("") + `</div>`;
}

// Builds the left sidebar for a given role. `active` = current page key.
function renderSidebar(role, active) {
  const user = getUser();
  const links = {
    admin: [
      { key: "dashboard", label: "Dashboard", icon: "&#9670;" },
      { key: "orders", label: "Orders", icon: "&#128230;" },
      { key: "users", label: "Team", icon: "&#128101;" },
      { key: "stock", label: "Stock", icon: "&#128202;" }
    ],
    sales: [
      { key: "dashboard", label: "Dashboard", icon: "&#9670;" },
      { key: "orders", label: "My Orders", icon: "&#128230;" }
    ],
    rider: [
      { key: "dashboard", label: "My Deliveries", icon: "&#128666;" }
    ]
  }[role];

  const nav = links.map((l) => `
    <a class="nav-link ${active === l.key ? "active" : ""}" href="/${role}.html${l.key === "dashboard" ? "" : "#" + l.key}" data-key="${l.key}">
      <span class="ic">${l.icon}</span> ${l.label}
    </a>
  `).join("");

  return `
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">S</div>
      <div class="brand-text">
        <div class="name">SDM CRM</div>
        <div class="sub">${role} panel</div>
      </div>
    </div>
    <div class="nav-group">
      <div class="nav-label">Menu</div>
      ${nav}
    </div>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="user-avatar">${initials(user ? user.fullName : "?")}</div>
        <div class="user-meta">
          <div class="u-name">${user ? user.fullName : ""}</div>
          <div class="u-role">${role}</div>
        </div>
      </div>
      <button class="logout-btn" onclick="logout()">Log out</button>
    </div>
  </aside>`;
}

function mobileMenuInit() {
  const btn = document.querySelector(".menu-btn");
  const sidebar = document.querySelector(".sidebar");
  if (btn && sidebar) {
    btn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
}
document.addEventListener("DOMContentLoaded", mobileMenuInit);

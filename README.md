# SDM CRM

A simple, focused CRM for a sales + delivery workflow:

**Sales Team** creates an order → **Admin** assigns it to a **Rider** → **Rider** updates the delivery status (On The Way → Delivered / Cancelled / Pending) → **Admin** sees everything, can create/edit/delete/assign any order, and manages stock + team accounts.

Products tracked: Men's Oil, Belly Oil, Face Serum, Hair Oil, Kinoki Patches, Ring.

---

## 1. What's inside

```
sdm-crm/
├── server.js            → starts the app
├── db.js                → simple built-in database (data/db.json file)
├── middleware/auth.js    → login/security check
├── routes/               → API: auth, users, products, orders, dashboard
├── public/                → the website (login + 3 dashboards)
│   ├── login.html
│   ├── admin.html / sales.html / rider.html
│   ├── css/style.css
│   └── js/
└── .env.example          → settings template
```

No external database server is needed — data is stored in `data/db.json`, created automatically the first time you run the app. This is enough for a small team (1 admin, 5 sales, 3 riders). If the company grows a lot bigger later, this can be swapped for a real database without changing how the app looks or works.

---

## 2. Run it on your own computer first (recommended before deploying)

You need **Node.js** installed (version 18+). Download from [nodejs.org](https://nodejs.org) if you don't have it.

1. Open a terminal in the `sdm-crm` folder.
2. Copy the settings file:
   - Windows: `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
3. Install dependencies:
   ```
   npm install
   ```
4. Start the app:
   ```
   npm start
   ```
5. Open your browser at **http://localhost:3000**

**First login (default admin account):**
- Username: `admin`
- Password: `Admin@123`

⚠️ Log in immediately and change this password (there's a "Change Password" capability built into the API — for now the fastest way is: Team page → you can reset any account's password, and for your own admin password use the `/api/auth/change-password` endpoint, or simply edit `ADMIN_PASSWORD` in `.env` before first run to set your own).

**Before first run**, it's easiest to just set your own admin password in `.env`:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourOwnStrongPassword123
```
Then run `npm start` — this becomes the real admin login.

---

## 3. How each role works

### Admin (you)
- **Dashboard**: total orders, status breakdown, revenue from delivered orders, rider performance, sales team performance, low stock warning.
- **Orders**: see every order, create new ones, edit any order, delete any order, assign/reassign a rider.
- **Team**: create login accounts for your 5 sales people and 3 riders (set username + password for each). You can disable an account (e.g. if someone leaves) or reset their password anytime.
- **Stock**: see live stock for all 6 products, add/remove stock, or set an exact number.

### Sales team member
- Logs in with the username/password you created for them.
- Creates a new order: customer name, phone, product, quantity, price, and **location** (they can type the address and/or tap "Use my current location" to attach exact GPS coordinates — this generates a Google Maps link automatically, no API key needed).
- Sees only the orders **they** created, and can edit/delete an order **only while it's still unassigned** (once you assign a rider, it locks — they'd need to ask you, the admin, to change it).

### Rider
- Logs in and sees only the orders **assigned to them**.
- When an order is assigned, it shows as "Assigned." They tap **Start Delivery** → status becomes **On The Way**.
- From there they mark it **Delivered**, **Cancelled**, or **Pending** (couldn't deliver, will retry).
- Each order card shows a tap-to-open Google Maps link for the delivery address.

### Stock behaviour (automatic)
- Stock is reserved (subtracted) the moment an order is **created**.
- If an order is **cancelled**, that stock is automatically returned.
- If an order is **deleted** (and wasn't already delivered), stock is returned too.
- This means your Stock page always reflects real, available inventory — not just a number you update by hand.

---

## 4. Deploying so your team can use it from anywhere (step by step)

The easiest free/cheap option is **Railway** (railway.app) because it gives you a persistent disk (your `data/db.json` won't get wiped), a free HTTPS link, and it's beginner-friendly. Steps below use Railway — an equivalent alternative is **Render.com** (same idea, look for "Persistent Disk" when creating the service).

### Step 1 — Put the code on GitHub
1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new repository, e.g. `sdm-crm`.
3. Upload the `sdm-crm` folder (drag-and-drop on GitHub's web upload page is fine — you don't need to know git commands).

### Step 2 — Create a Railway account
1. Go to [railway.app](https://railway.app) → sign up (you can sign up with your GitHub account, which makes step 3 easier).

### Step 3 — Deploy
1. In Railway, click **New Project → Deploy from GitHub repo**.
2. Select your `sdm-crm` repository.
3. Railway will detect it's a Node.js app and build it automatically.

### Step 4 — Add a persistent volume (important — this is what stores your orders/users permanently)
1. In your Railway project, open your service → **Settings → Volumes**.
2. Add a new volume, mount path: `/app/data`
3. This makes sure `db.json` survives restarts and redeploys.

### Step 5 — Set environment variables
In your service → **Variables**, add:
```
JWT_SECRET=make-this-a-long-random-string-only-you-know
JWT_EXPIRES_IN=12h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourOwnStrongPassword123
```
(Pick your own values — especially `JWT_SECRET` and `ADMIN_PASSWORD`.)

### Step 6 — Get your live link
1. In **Settings → Networking**, click **Generate Domain**.
2. Railway gives you a link like `https://sdm-crm-production.up.railway.app`.
3. Share this link with your sales team and riders — this is the CRM's address. They just open it on their phone browser and log in.

### Step 7 — First-time setup on the live site
1. Open the live link, log in as admin.
2. Go to **Team** → create accounts for your 5 sales members and 3 riders (give each their own username/password).
3. Go to **Stock** → set correct starting stock numbers for all 6 products.
4. Done — sales can start creating orders.

---

## 5. A few practical tips for running this day-to-day

- **Phones work fine** — the whole site is mobile-friendly, riders and sales can use it directly from their phone browser (Chrome/Safari). No app install needed. You could add it to their home screen for an app-like icon (browser menu → "Add to Home Screen").
- **Location accuracy**: "Use my current location" only works well if the sales person is entering the order while near the actual delivery point, or if the customer shares their location and it's typed as an address. For most COD/delivery businesses, typing the address is usually enough — GPS is a nice-to-have bonus.
- **Back up your data occasionally**: `data/db.json` is your entire database. On Railway you can download it from the volume, or just periodically export/screenshot your order list. If you outgrow this later, migrating to a proper database (Postgres) is straightforward since all the data logic lives in one file (`db.js`).
- **Passwords**: only the admin can create/reset sales and rider passwords — there's no self-signup, which keeps the CRM closed to only the people you approve.
- **Renaming things**: product names, colors, and the "SDM" branding are all easy to change later — team names in `public/css/style.css` (colors) and the product list is managed from the Stock page (admin can add/rename products).

---

## 6. If something goes wrong

- **Can't log in**: double check username/password are exact (case-sensitive). Admin can reset any sales/rider password from the Team page.
- **"Not enough stock" error when creating an order**: check the Stock page — you may need to top up inventory.
- **Page looks broken after deploying**: make sure the volume is mounted at `/app/data` (Step 4) — without it, the app still works but resets data on every redeploy.
- **Forgot admin password**: change `ADMIN_PASSWORD` in your environment variables and delete `data/db.json` (this resets ALL data, so only do this before you have real orders in the system) — after that a fresh admin account is created automatically on next start.

---

Built as a lightweight, dedicated tool for one company's real delivery workflow — no unnecessary features, in plain English throughout.

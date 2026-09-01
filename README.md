# PetStation Management Dashboard

## Quick Start
Double-click `START-PETSTATION.bat` — it launches both the backend and dashboard.

- **Dashboard**: http://localhost:5173
- **Backend (Zoo QR)**: http://localhost:3000

---

## Login Credentials (all use same password: `petstation2026`)

| Username     | Role         | Access                                              |
|-------------|--------------|-----------------------------------------------------|
| admin1      | Super Admin  | Everything + User Management + QR Codes             |
| admin2      | Super Admin  | Everything + User Management + QR Codes             |
| accountant  | Accountant   | Dashboard, Billing, Expenses, Reports, Ledgers      |
| employee1   | Employee     | Dashboard, Billing                                  |
| employee2   | Employee     | Dashboard, Billing                                  |
| marketing   | Marketing    | Dashboard, Marketing, QR Codes                      |

---

## Features

### 🔐 Role-Based Access Control
- Super Admins can grant/revoke any section access to any user
- Go to **User Management** → click **Permissions** on any user
- Changes take effect immediately on next login

### 🎫 Billing (Offline-Capable)
- Works fully offline — all data saved to browser localStorage
- Shows sync status (⏳ pending / ✅ synced) per transaction
- Click **Sync** on Dashboard to push pending entries to backend
- Supports Cash, UPI, Card payment methods

### 📊 Dashboard
- Today's revenue, expenses, net cashflow
- Last 7 days bar chart
- Payment split pie chart
- Pending sync indicator with one-click sync

### 📱 QR Codes (Super Admin + Marketing)
- Create QR codes linked to animals
- Assign/reassign animals to QR codes
- Download QR images
- Requires zoo backend to be running

### 📣 Marketing
- Visitor analytics (total scans, unique visitors, registered)
- Most scanned animals leaderboard
- Animal profile browser

### ⚙️ Settings
- Configure backend URL and admin token
- Add/edit/delete ticket items and prices
- Export data backup as JSON
- Opening balance configuration

---

## Architecture

```
petstation-dashboard/     ← React + Vite + TypeScript (this app)
  src/
    store/AppContext.tsx   ← All state, auth, offline storage
    pages/
      Login.tsx           ← Auth with quick-login hints
      Dashboard.tsx       ← Stats + charts + sync
      Billing.tsx         ← Offline POS billing
      Expenses.tsx        ← Expense entry with ledgers
      Reports.tsx         ← Daily report
      Ledgers.tsx         ← Ledger/sub-ledger management
      QRCodes.tsx         ← QR dashboard (connects to backend)
      Marketing.tsx       ← Analytics + animal profiles
      UserManagement.tsx  ← User + permission management
      Settings.tsx        ← System config

zoo-qr-system/zoo-qr/    ← Node.js + SQLite backend
  backend/
    server.js             ← Express API (+ new /api/billing/sync)
    db.js                 ← SQLite schema
```

## Billing Sync API (added to backend)
- `POST /api/billing/sync` — push offline billing entries
- `GET /api/billing/entries?date=YYYY-MM-DD` — fetch entries
- `GET /api/billing/summary?from=&to=` — date range summary

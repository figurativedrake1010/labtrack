# LabTrack 🔬
> Real-time Campus Hardware Equipment & Robotics Lab Checkout Tracker

LabTrack was built for  student coordinator of the college Robotics & Maker Society, to solve the chaotic hardware checkouts during university hackathons and lab sessions.

It provides a single-screen live inventory of 12 real robotics, compute, and sensing kits stored across Locker B and Workbench 1–3, allowing students to check out and return gear with instant status updates and an audit trail.

---

## Features
- **Real Campus Hardware Inventory:** Pre-seeded with 12 authentic hardware modules (Jetson Nano, RPLIDAR, Raspberry Pi 4, Arduino Mega, RealSense D435i, etc.).
- **Live Status Badges:** Visual indicators for `Available` (emerald) and `Checked Out` (amber with borrower details and timestamps).
- **Search & Filters:** Instant client-side search across tags, component names, categories, and borrower names.
- **Audit Logging:** Every checkout and return is timestamped in the PostgreSQL `checkout_history` table.
- **Zero-Config Deployment:** Automatic schema creation and seed insertion on initial startup.
- **Health Check Endpoint:** `GET /healthz` answering `ok` for platform uptime monitoring.

---

## Tech Stack
- **Runtime:** Node.js (v20+)
- **Database:** PostgreSQL (v14+)
- **Dependencies:** `pg` (PostgreSQL client)
- **Deployment Platform:** Selfhost.dev (driven via MCP server)

---

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` / `PG_URL` | PostgreSQL connection string | *Required* |
| `PORT` | Web server port | `3000` |
| `HOST` | Interface to listen on | `0.0.0.0` |

---

## API Endpoints

- `GET /`: Responsive web dashboard
- `GET /healthz`: Health check endpoint (answers `ok`)
- `GET /api/equipment`: JSON list of all equipment items
- `POST /checkout`: Body params: `tag`, `borrower_name`, `borrower_contact`, `purpose`
- `POST /return`: Body params: `tag`, `actor`

---

## Local Development

```bash
npm install
export DATABASE_URL="postgresql://user:password@localhost:5432/labtrack"
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

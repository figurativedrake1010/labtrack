# Selfhost.dev Developer Projects Intern — Assessment Submission (Brief B)

---

## Candidate & Submission Metadata

- **Candidate Name:** Ayush Anand
- **Selfhost.dev Account Email:** `ayush.preety5@gmail.com`
- **Project Name:** LabTrack — Campus Robotics & Hardware Checkout System
- **Public Application URLs:**
  - **LabTrack (Custom Project):** `https://labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud`
  - **linkdrop (Starter App):** `https://linkdrop-fe7ff5de.23.88.60.255.nip.swatantra.cloud`
- **GitHub Repositories:**
  - **linkdrop Fork:** `https://github.com/figurativedrake1010/linkdrop`
  - **LabTrack Repository:** `https://github.com/figurativedrake1010/labtrack`
- **Walkthrough Video:** `https://drive.google.com/file/d/1ondFtNWz0fxFtWcZ1NUdyAop69XjmHDb/view?usp=sharing`
- **Assigned Platform Ingredient:** Your AI editor only, through the Selfhost.dev MCP server (`@selfhost.dev/mcp-server`).
- **Tools Used & Purposes:**
  - **Node.js (v20 LTS):** Native HTTP runtime powering both minimal web services without heavy frameworks.
  - **PostgreSQL (v16):** Project database on Selfhost.dev storing relational reading lists and inventory audit tables.
  - **Git & GitHub:** Version control, tracking incremental bug fixes, and driving continuous auto-deploys on push.
  - **Selfhost.dev MCP Server (`@selfhost.dev/mcp-server`):** First-party AI infrastructure control plane providing 216 tools across 32 modules to provision servers, databases, wire environment variables, and manage deploys directly from our AI editor in natural language.
  - **Claude Code / Cursor AI Editor:** Used as the primary AI agent client driving the MCP tools.

---

# Part 1: The Starter App (`linkdrop`) — Diagnosis & Fixes

`linkdrop` is a minimal shared reading list built with pure Node.js and PostgreSQL. While it ran locally on the author's laptop, several defects surfaced upon deploying it into a cloud container environment on Selfhost.dev. In accordance with the brief (*"Change only what is broken... Leave the README true for the next developer"*), we fixed the following issues incrementally:

### Problem 1: Unreachable Web Service (502 Bad Gateway)
- **What Was Seen:** Upon the initial deployment via Selfhost.dev, the Nixpacks build passed in 38s, but accessing the public domain returned `502 Bad Gateway`. Streaming logs showed:
  ```text
  linkdrop listening on http://localhost:8080
  ```
- **Root Cause:** In containerized environments with reverse proxies, binding to `localhost` (`127.0.0.1`) restricts listening exclusively to the container's loopback interface. Ingress traffic from the public proxy cannot reach the process. Additionally, port `8080` was hardcoded while platforms often provide an assigned port via `process.env.PORT`.
- **The Fix:** Updated `config.js` to bind to `0.0.0.0` and dynamically read `process.env.PORT`:
  ```javascript
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  ```
- **Commit in Fork:** `48454be` (*fix(network): bind to 0.0.0.0 and dynamically listen on PORT*)

---

### Problem 2: Database Connection Variable Mismatch
- **What Was Seen:** When configuring the database via Selfhost.dev, the pool failed to establish a connection if the connection string was passed under `PG_URL` as specified in the README and `.env.example`.
- **Root Cause:** `config.js` only looked for `process.env.DATABASE_URL`, ignoring `process.env.PG_URL`.
- **The Fix:** Added a fallback in `config.js` to accept either standard naming convention:
  ```javascript
  databaseUrl: process.env.DATABASE_URL || process.env.PG_URL,
  ```
- **Commit in Fork:** `4ff62fa` (*fix(db): fall back to PG_URL environment variable*)

---

### Problem 3: Runtime Crash on First Request (`relation "links" does not exist`)
- **What Was Seen:** When loading the root page on a fresh database instance, the server crashed with HTTP 500:
  ```text
  error: relation "links" does not exist
      at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:287:98)
  ```
- **Root Cause:** The application assumed `db/schema.sql` was pre-executed manually on the host. When attaching a freshly provisioned PostgreSQL database on Selfhost.dev, the table did not exist.
- **The Fix:** Added an automatic startup initialization routine (`initDb()`) in `server.js` executing `CREATE TABLE IF NOT EXISTS links (...)` before starting the HTTP server listener.
- **Commit in Fork:** `c7ad331` (*fix(db): automatically initialize links table on server startup*)

---

### Problem 4: Query Sort Order Inversion (Violating Product Specification)
- **What Was Seen:** After adding more than 20 links during load testing, newly added links failed to appear on the homepage.
- **Root Cause:** The product specification states: *"Everyone with the address sees the 20 newest links, newest first."* The query in `server.js` was written as:
  ```sql
  SELECT url, note, created_at FROM links ORDER BY created_at LIMIT $1
  ```
  In PostgreSQL, `ORDER BY` defaults to ascending (oldest first). This inverted the order and clipped all newly submitted items once the table grew beyond 20 rows.
- **The Fix:** Updated query to `ORDER BY created_at DESC LIMIT $1` and added basic HTML entity escaping to prevent markup breakage.
- **Commit in Fork:** `d950911` (*fix(links): sort by created_at DESC and escape HTML content*)

---

### Problem 5: Outdated Documentation in README
- **What Was Seen:** The original README claimed the application listened on port 3000 by default and only supported `PG_URL`.
- **The Fix:** Updated `README.md` to accurately document the default port (8080), the accepted environment variables (`DATABASE_URL`, `PG_URL`, `PORT`, `HOST`), and the automatic schema migration.
- **Commit in Fork:** `05a5184` (*docs: update README with actual default port, configuration, and auto-init*)

---

# Part 2 & 3: The Custom Project — LabTrack

## 1. The Problem & The Real User

- **Who it is for:** **Rahul**, a 3rd-year engineering student and the elected Student Coordinator of our university's Robotics & Maker Society.
- **What he told me:**  
  > *"During hackathons and lab sessions, students constantly borrow our single Jetson Nano, RPLIDAR scanner, depth cameras, and soldering kits. By evening, people argue on WhatsApp asking who took which board, contact numbers are missing, and parts get misplaced right before inter-college robotics competitions."*
- **What LabTrack does:** LabTrack is a single-screen real-time checkout system. It provides a live dashboard of 12 actual lab hardware kits categorized across compute, microcontrollers, sensors, actuation, tools, and power. Students can see availability at a glance, check out an item with their name and project purpose in two clicks, and mark it returned upon placing it back into Locker B or Workbench 1–3.

---

## 2. Real Data Collected

The application contains real hardware inventory from our campus robotics locker:
1. `RP4-01`: Raspberry Pi 4 Model B (4GB RAM) — Locker B1 (Available)
2. `RP4-02`: Raspberry Pi 4 Model B (8GB RAM) — Locker B1 (Available)
3. `JET-01`: NVIDIA Jetson Nano Developer Kit (4GB) — Locker B2 (Checked out by Aditya Sharma for Autonomous rover vision)
4. `ARD-01`: Arduino Mega 2560 Rev3 — Bin D1 (Available)
5. `ESP-03`: ESP32-WROOM-32D Development Board (Pack of 3) — Bin D2 (Available)
6. `LIDAR-01`: RPLIDAR A1M8 360-Degree Laser Scanner — Locker C3 (Checked out by Tanvi Mehta for SLAM mapping test rig)
7. `RS-01`: Intel RealSense D435i Depth Camera — Locker A1 (Available)
8. `IMU-02`: MPU-9250 9-Axis Gyro/Accelerometer/Magnetometer — Bin D3 (Available)
9. `ULT-01`: HC-SR04 Ultrasonic Distance Sensor Set (4x) — Bin D2 (Available)
10. `MD-04`: TB6612FNG Dual DC Motor Driver Module — Bin D4 (Available)
11. `SLD-02`: TS100 Smart Mini Digital Soldering Iron Kit — Workbench 3 (Available)
12. `PS-01`: 12V 30A DC Regulated Bench Power Supply — Workbench 1 (Available)

---

## 3. The First Screen

The user lands on a clean, high-contrast dark dashboard:
- **Top bar:** Live statistics displaying **Total Items (12)**, **Available (10)**, and **Checked Out (2)**.
- **Filter bar:** Instant toggle between All, Available, and Checked Out items, plus an instant search input matching hardware tags, names, or borrower identities.
- **Equipment Grid:** Visual cards with green status pills (`● Available`) and amber status pills (`● Checked Out` detailing borrower name, project purpose, and timestamp).
- **Audit Log:** A bottom table recording every historical checkout and return transaction with timestamps.

*(Insert screenshot of live LabTrack application running at `https://labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud` here)*

---

## 4. How the Pieces Connect (Architecture Diagram)

```
[ User Browser ]
       |
       |  (1) HTTPS GET/POST Requests
       v
[ Selfhost.dev Edge Proxy / SSL Termination ]
       |
       |  (2) Ingress HTTP Traffic (Port 3000)
       v
[ LabTrack Node.js Process (Hetzner Small Compute) ]
       |
       |  (3) Encrypted Connection Pooling (Port 5432)
       v
[ Project PostgreSQL Database ]
```

### Explanations for Each Arrow:
- **Arrow 1:** The user's browser sends secure HTTPS requests to the assigned Selfhost.dev public domain (`labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud`), which handles automatic TLS certificate issuance and SSL termination at the edge.
- **Arrow 2:** The Selfhost.dev edge router forwards raw HTTP traffic internally to the containerized Node.js process listening on `0.0.0.0:3000` managed under Nixpacks.
- **Arrow 3:** The Node.js application initiates connection-pooled SQL queries over the internal network to the project's PostgreSQL database to fetch inventory state and persist checkout history.

---

## 5. Step-by-Step Reproduction Guide

A developer with a fresh Selfhost.dev account can reproduce this exact deployment in 5 minutes:

### Step 1: Install the Selfhost.dev MCP Server
Run in your local terminal:
```bash
npm install -g @selfhost.dev/mcp-server
```
Add to your AI editor's MCP configuration (`claude_desktop_config.json` or Cursor Settings):
```json
{
  "mcpServers": {
    "selfhost": {
      "command": "npx",
      "args": ["@selfhost.dev/mcp-server"]
    }
  }
}
```
Run `npx @selfhost.dev/mcp-server` once in your terminal to complete browser-based authentication.

### Step 2: Create the Project via AI Editor Prompt
Issue the following instruction to your AI editor:
> *"Using the Selfhost MCP tools, inspect my account, create a new project named 'ayush-internship' on the smallest server size (~$0.50/day in EU), and provision a project PostgreSQL database."*

The MCP server executes:
1. `create_project` (`plan: "small"`)
2. `create_project_database` (`engine: "postgres"`)

### Step 3: Deploy the Repository
Issue the deployment prompt:
> *"Deploy my public GitHub repository https://github.com/figurativedrake1010/labtrack into the 'ayush-internship' project. Connect the project's PostgreSQL connection string as DATABASE_URL, set PORT=3000, trigger the build, and assign a public domain."*

The MCP server executes:
1. `merge_env_vars` (`DATABASE_URL=postgresql://user:placeholder@host:5432/db`, `PORT=3000`)
2. `trigger_deploy` (`repo: "figurativedrake1010/labtrack"`)
3. `add_deployment_domain` (`domain: "labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud"`)

### Step 4: Verification
Open `https://labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud/healthz` to confirm the process returns `ok`, then visit `https://labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud` to see the live hardware catalog.

---

## 6. What Broke & How It Was Resolved

- **Failure Encountered:** During initial deployment of LabTrack, the service booted but returned `500 Internal Server Error` when submitting the checkout form.
- **Error in Logs:**
  ```text
  TypeError: Cannot read properties of undefined (reading 'get')
      at server.js:242:25
  ```
- **What Was Tried That Failed:** We initially parsed incoming POST requests using `JSON.parse(body)`. However, standard HTML `<form>` submissions send `application/x-www-form-urlencoded` payloads rather than JSON strings, which caused JSON parsing to fail silently.
- **The Solution:** Implemented a lightweight body parser using `URLSearchParams(body)`, which cleanly parses native HTML form submissions with zero external dependencies.

---

## 7. What It Cost (Wallet Activity Evidence)

From the **Billing & Credits / Wallet Activity** dashboard in `console.selfhost.dev`:
- **Available Balance:** **\$8.16** (prepaid credits, no subscription or surprise bill).
- **Total Usage Spend Displayed:** **\$1.84** (100% under `Compute`, $0.10 peak hour, 21 usage rows).
- **Current Spend Rate:** **\$0.09 per hour**.
- **Estimated Runway:** **About 3 days left** with both applications actively running.
- **Credit Transactions:** \$5.00 free credit coupon transaction applied, leaving plenty of credit headroom.
- **Single Project Footprint:** Both `linkdrop` and `labtrack` share the single small compute server and project PostgreSQL database, keeping aggregate costs well within the platform credit allocation.

---

## Below the Last Line (Private Feedback — Not for Publication)

> **One thing about Selfhost.dev that surprised me:**  
> The speed and depth of the MCP server (`@selfhost.dev/mcp-server`) with 216 first-party tools was remarkably capable. Being able to wire database credentials, check deployment logs, and assign domains directly through conversational terminal prompts without wrestling with AWS IAM roles or complex Docker Compose configurations felt like a genuine preview of how cloud infrastructure will be managed going forward.

---

# Part 4: Four Short Things

### 1. Platform Friction Log

| Location / URL | What I Did | What Happened | What I Expected | Screenshot Placeholder |
|---|---|---|---|---|
| Windows PowerShell CLI | Ran `npx @selfhost.dev/mcp-server` during initial setup. | PowerShell threw a syntax error (`splatting operator '@' cannot be used`) and blocked `npx.ps1` execution policy. | Expected documentation mentioning quotes (`npx "@selfhost.dev/mcp-server"`) or `cmd /c` on Windows. | `[friction_screenshot_cli.png]` |
| `console.selfhost.dev/projects/.../env` | Pasted a PostgreSQL connection string containing special characters in the password. | The input field silently trimmed the string after an `#` symbol. | Expected full string preservation or an escaped input validation warning. | `[friction_screenshot_1.png]` |
| `console.selfhost.dev/deploy/logs` | Clicked "Trigger Deploy" from the console while monitoring logs. | The UI showed a spinner for 18 seconds before streaming any build stdout lines. | An instant indicator like *"Worker allocated, pulling container image..."* to confirm the build wasn't stalled. | `[friction_screenshot_2.png]` |
| `console.selfhost.dev/databases` | Looked for the project database connection string to test with psql. | Had to click through Project -> Settings -> Services -> Database to find the internal URI instead of an obvious "Copy URI" button on the database card. | A direct copy button for internal connection strings directly on the service overview. | `[friction_screenshot_3.png]` |

---

### 2. The Post for Developers (< 120 words)

> *Built a lightweight hardware checkout board for our university robotics lab this weekend and deployed it on Selfhost.dev using their MCP server.*  
> *Rather than clicking through cloud consoles or writing Terraform scripts, I hooked `@selfhost.dev/mcp-server` into Claude Code. A single conversational prompt provisioned the Hetzner compute instance, spun up PostgreSQL, wired connection strings, and triggered Nixpacks auto-deploys on GitHub push.*  
> *Kept both the app and a shared reading list on their smallest server tier with usage tracked in the platform Wallet Activity. Full tutorial with architecture breakdown and port binding gotchas: [Link to Write-up]*

---

### 3. Three Next Projects to Build on Selfhost.dev

1. **Self-Hosted Uptime & Webhook Ping Monitor for Micro-Services**
   - *What it is:* A lightweight heartbeat daemon that pings healthcheck endpoints every 60 seconds and fires alert webhooks to Discord/Telegram if a container drops.
   - *Real Developer Request:* [Reddit discussion on r/selfhosted](https://www.reddit.com/r/selfhosted/comments/182k6t1/lightweight_alternative_to_uptime_kuma_for_low/) requesting a minimal, low-memory alternative to Uptime Kuma that runs under 30MB RAM.
2. **Automated Academic Paper & ArXiv RSS Digest Bot**
   - *What it is:* A background worker running on Node.js that scrapes new CS/AI submissions on ArXiv daily, summarizes abstracts, and posts a categorized markdown digest to a team channel.
   - *Real Developer Request:* [GitHub Issue on arxiv-sanity](https://github.com/karpathy/arxiv-sanity-preserver/issues/148) where researchers ask for an automated personal notification pipeline without managing complex Kubernetes clusters.
3. **Local Store Daily Inventory & Special Order Reserve System**
   - *What it is:* A single-page reservation catalog for neighborhood bakeries and cafes to post daily batch availability and prevent redundant WhatsApp inquiries.
   - *Real Developer Request:* [Reddit thread on r/smallbusiness](https://www.reddit.com/r/smallbusiness/comments/192mfx9/simple_tool_to_show_daily_stock_for_home_bakery/) where independent bakers ask for a zero-maintenance daily stock display.

---

### 4. The 2-Minute Video Recording

- **Walkthrough Video Link:** `https://drive.google.com/file/d/1ondFtNWz0fxFtWcZ1NUdyAop69XjmHDb/view?usp=sharing`
- **Contents:**
  - `0:00 - 0:45`: Opened `https://labtrack-ac01cb86.23.88.60.255.nip.swatantra.cloud`, demonstrated live checkout of Arduino Mega 2560 and instant return.
  - `0:45 - 1:15`: Opened `https://linkdrop-fe7ff5de.23.88.60.255.nip.swatantra.cloud`, dropped a test link to prove ordering by newest first.
  - `1:15 - 2:00`: Switched to `console.selfhost.dev`, showed both services running inside the single project, the green build log, and confirmed Wallet Activity ($1.84 usage spend, $8.16 available balance, $0.09/hr spend).

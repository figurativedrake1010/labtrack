const http = require('node:http');
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

async function initDbAndSeed() {
  if (!config.databaseUrl) {
    console.warn('DATABASE_URL or PG_URL not configured. Running without DB connection.');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id               bigserial PRIMARY KEY,
        tag              varchar(32) UNIQUE NOT NULL,
        name             varchar(128) NOT NULL,
        category         varchar(64) NOT NULL,
        location         varchar(64) NOT NULL,
        status           varchar(32) NOT NULL DEFAULT 'AVAILABLE',
        borrower_name    varchar(128) NOT NULL DEFAULT '',
        borrower_contact varchar(128) NOT NULL DEFAULT '',
        purpose          text NOT NULL DEFAULT '',
        checked_out_at   timestamptz,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS checkout_history (
        id         bigserial PRIMARY KEY,
        tag        varchar(32) NOT NULL,
        action     varchar(32) NOT NULL,
        actor      varchar(128) NOT NULL,
        purpose    text NOT NULL DEFAULT '',
        timestamp  timestamptz NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await pool.query('SELECT COUNT(*)::int as count FROM equipment');
    if (rows[0].count === 0) {
      console.log('Seeding initial 12 lab hardware records...');
      await pool.query(`
        INSERT INTO equipment (tag, name, category, location, status, borrower_name, borrower_contact, purpose, checked_out_at)
        VALUES 
          ('RP4-01', 'Raspberry Pi 4 Model B (4GB RAM)', 'Compute', 'Locker B1', 'AVAILABLE', '', '', '', NULL),
          ('RP4-02', 'Raspberry Pi 4 Model B (8GB RAM)', 'Compute', 'Locker B1', 'AVAILABLE', '', '', '', NULL),
          ('JET-01', 'NVIDIA Jetson Nano Developer Kit (4GB)', 'Compute', 'Locker B2', 'CHECKED_OUT', 'Aditya Sharma', 'aditya.s@campus.edu', 'Autonomous rover vision project', now() - interval '2 days'),
          ('ARD-01', 'Arduino Mega 2560 Rev3', 'Microcontroller', 'Bin D1', 'AVAILABLE', '', '', '', NULL),
          ('ESP-03', 'ESP32-WROOM-32D Dev Board (Pack of 3)', 'Microcontroller', 'Bin D2', 'AVAILABLE', '', '', '', NULL),
          ('LIDAR-01', 'RPLIDAR A1M8 360-Degree Laser Scanner', 'Sensors', 'Locker C3', 'CHECKED_OUT', 'Tanvi Mehta', 'tanvi.m@campus.edu', 'SLAM mapping test rig', now() - interval '5 hours'),
          ('RS-01', 'Intel RealSense D435i Depth Camera', 'Sensors', 'Locker A1', 'AVAILABLE', '', '', '', NULL),
          ('IMU-02', 'MPU-9250 9-Axis Gyro/Accelerometer/Mag', 'Sensors', 'Bin D3', 'AVAILABLE', '', '', '', NULL),
          ('ULT-01', 'HC-SR04 Ultrasonic Distance Sensor Set (4x)', 'Sensors', 'Bin D2', 'AVAILABLE', '', '', '', NULL),
          ('MD-04', 'TB6612FNG Dual DC Motor Driver Module', 'Actuation', 'Bin D4', 'AVAILABLE', '', '', '', NULL),
          ('SLD-02', 'TS100 Smart Mini Digital Soldering Iron Kit', 'Tools', 'Workbench 3', 'AVAILABLE', '', '', '', NULL),
          ('PS-01', '12V 30A DC Regulated Bench Power Supply', 'Power', 'Workbench 1', 'AVAILABLE', '', '', '', NULL)
        ON CONFLICT (tag) DO NOTHING;
      `);
    }
    console.log('Database initialized and verified.');
  } catch (err) {
    console.error('Database migration/seed warning:', err.message);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50_000) req.destroy();
    });
    req.on('end', () => resolve(new URLSearchParams(body)));
    req.on('error', reject);
  });
}

async function getInventory() {
  const { rows } = await pool.query(
    'SELECT * FROM equipment ORDER BY category ASC, tag ASC'
  );
  return rows;
}

async function getRecentLogs() {
  const { rows } = await pool.query(
    'SELECT * FROM checkout_history ORDER BY timestamp DESC LIMIT 10'
  );
  return rows;
}

function renderHtml(items, logs) {
  const total = items.length;
  const available = items.filter((i) => i.status === 'AVAILABLE').length;
  const checkedOut = total - available;

  const itemCards = items
    .map((item) => {
      const isAvail = item.status === 'AVAILABLE';
      const statusBadge = isAvail
        ? '<span class="badge badge-avail">● Available</span>'
        : '<span class="badge badge-out">● Checked Out</span>';

      const detailsHtml = isAvail
        ? `<div class="meta"><span>Location:</span> <strong>${escapeHtml(item.location)}</strong></div>`
        : `<div class="meta">
             <div><span>Borrower:</span> <strong>${escapeHtml(item.borrower_name)}</strong> (${escapeHtml(item.borrower_contact)})</div>
             <div><span>Purpose:</span> <em>"${escapeHtml(item.purpose)}"</em></div>
             <div><span>Since:</span> ${new Date(item.checked_out_at).toLocaleString()}</div>
           </div>`;

      const actionHtml = isAvail
        ? `<details class="action-details">
             <summary class="btn btn-primary">Check Out</summary>
             <form method="POST" action="/checkout" class="action-form">
               <input type="hidden" name="tag" value="${escapeHtml(item.tag)}">
               <input type="text" name="borrower_name" placeholder="Your Name (e.g. Rahul S.)" required>
               <input type="text" name="borrower_contact" placeholder="Campus Email / Phone" required>
               <input type="text" name="purpose" placeholder="Project / Hackathon purpose" required>
               <button type="submit" class="btn btn-confirm">Confirm Checkout</button>
             </form>
           </details>`
        : `<form method="POST" action="/return" style="display:inline">
             <input type="hidden" name="tag" value="${escapeHtml(item.tag)}">
             <input type="hidden" name="actor" value="${escapeHtml(item.borrower_name || 'Borrower')}">
             <button type="submit" class="btn btn-secondary">Mark Returned</button>
           </form>`;

      return `
        <div class="card ${isAvail ? 'card-avail' : 'card-out'}" data-status="${item.status.toLowerCase()}" data-search="${escapeHtml(item.tag + ' ' + item.name + ' ' + item.category + ' ' + item.location + ' ' + item.borrower_name).toLowerCase()}">
          <div class="card-header">
            <div>
              <span class="tag-pill">${escapeHtml(item.tag)}</span>
              <span class="cat-pill">${escapeHtml(item.category)}</span>
            </div>
            ${statusBadge}
          </div>
          <h3 class="item-title">${escapeHtml(item.name)}</h3>
          ${detailsHtml}
          <div class="card-footer">
            ${actionHtml}
          </div>
        </div>
      `;
    })
    .join('\n');

  const logRows = logs.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#64748b">No checkout history recorded yet.</td></tr>'
    : logs
        .map(
          (l) => `
      <tr>
        <td><strong>${escapeHtml(l.tag)}</strong></td>
        <td><span class="badge ${l.action === 'CHECKOUT' ? 'badge-out' : 'badge-avail'}">${escapeHtml(l.action)}</span></td>
        <td>${escapeHtml(l.actor)} ${l.purpose ? `<small>(${escapeHtml(l.purpose)})</small>` : ''}</td>
        <td><time>${new Date(l.timestamp).toLocaleTimeString()} - ${new Date(l.timestamp).toLocaleDateString()}</time></td>
      </tr>
    `
        )
        .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LabTrack · Campus Robotics Hardware Checkout</title>
<style>
  :root {
    --bg: #03110a;
    --card-bg: #081c12;
    --border: #143522;
    --brand: #34d59a;
    --brand-hover: #2cb381;
    --amber: #fbbf24;
    --text: #e6f6ee;
    --text-muted: #8aa697;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 24px 16px 60px;
    line-height: 1.5;
  }
  .container { max-width: 1040px; margin: 0 auto; }
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 20px;
    margin-bottom: 24px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }
  .logo-title h1 {
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo-title h1 span.dot {
    width: 12px;
    height: 12px;
    background: var(--brand);
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 12px var(--brand);
  }
  .logo-title p {
    color: var(--text-muted);
    font-size: 14px;
    margin-top: 4px;
  }
  .stats-bar {
    display: flex;
    gap: 12px;
  }
  .stat-badge {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .stat-badge strong { color: #fff; font-size: 16px; margin-left: 6px; }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
    align-items: center;
  }
  .search-input {
    flex: 1;
    min-width: 240px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 14px;
    outline: none;
  }
  .search-input:focus { border-color: var(--brand); }
  .filter-btn {
    background: var(--card-bg);
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s;
  }
  .filter-btn.active, .filter-btn:hover {
    background: var(--border);
    color: #fff;
    border-color: var(--brand);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 16px;
    margin-bottom: 48px;
  }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.15s, border-color 0.15s;
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: #215537;
  }
  .card-out { border-left: 4px solid var(--amber); }
  .card-avail { border-left: 4px solid var(--brand); }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .tag-pill {
    background: #020905;
    border: 1px solid var(--border);
    color: #fff;
    font-family: monospace;
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 600;
  }
  .cat-pill {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .item-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 10px;
    line-height: 1.35;
  }
  .meta {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .meta strong { color: #d0e7dc; }
  .meta em { color: var(--amber); }
  .badge {
    font-size: 11.5px;
    padding: 3px 8px;
    border-radius: 999px;
    font-weight: 600;
    display: inline-block;
  }
  .badge-avail { background: rgba(52, 213, 154, 0.12); color: var(--brand); border: 1px solid rgba(52, 213, 154, 0.3); }
  .badge-out { background: rgba(251, 191, 36, 0.12); color: var(--amber); border: 1px solid rgba(251, 191, 36, 0.3); }
  .card-footer { margin-top: auto; padding-top: 10px; }
  .btn {
    display: inline-block;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    text-align: center;
    transition: background 0.15s;
  }
  .btn-primary { background: var(--brand); color: #02120b; }
  .btn-primary:hover { background: var(--brand-hover); }
  .btn-secondary { background: #163625; color: #fff; border: 1px solid var(--border); }
  .btn-secondary:hover { background: #214f36; }
  .btn-confirm { background: var(--brand); color: #02120b; width: 100%; margin-top: 8px; }
  .action-details summary { list-style: none; }
  .action-details summary::-webkit-details-marker { display: none; }
  .action-form {
    background: #020b06;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
    display: grid;
    gap: 8px;
  }
  .action-form input {
    background: #081a11;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 10px;
    color: #fff;
    font-size: 12.5px;
  }
  .history-section {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .history-section h2 {
    font-size: 18px;
    margin-bottom: 14px;
    color: #fff;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
  td { padding: 10px; border-bottom: 1px solid #0f271a; }
  footer {
    text-align: center;
    margin-top: 40px;
    font-size: 12.5px;
    color: var(--text-muted);
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="logo-title">
      <h1><span class="dot"></span> LabTrack</h1>
      <p>Robotics &amp; Maker Society · Locker B &amp; Workbench Equipment Tracker</p>
    </div>
    <div class="stats-bar">
      <div class="stat-badge">Total Items: <strong>${total}</strong></div>
      <div class="stat-badge">Available: <strong style="color:var(--brand)">${available}</strong></div>
      <div class="stat-badge">Checked Out: <strong style="color:var(--amber)">${checkedOut}</strong></div>
    </div>
  </header>

  <div class="controls">
    <input type="text" id="searchInput" class="search-input" placeholder="Search by hardware name, tag (e.g. RP4, JET, LIDAR), or borrower...">
    <button class="filter-btn active" onclick="setFilter('all', this)">All (${total})</button>
    <button class="filter-btn" onclick="setFilter('available', this)">Available (${available})</button>
    <button class="filter-btn" onclick="setFilter('checked_out', this)">Checked Out (${checkedOut})</button>
  </div>

  <div class="grid" id="equipmentGrid">
    ${itemCards}
  </div>

  <section class="history-section">
    <h2>Recent Activity Audit Log</h2>
    <table>
      <thead>
        <tr>
          <th>Hardware Tag</th>
          <th>Action</th>
          <th>Student / Details</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        ${logRows}
      </tbody>
    </table>
  </section>

  <footer>
    <p>LabTrack · Running on <strong>Selfhost.dev</strong> via MCP &amp; PostgreSQL · Real campus hardware inventory</p>
  </footer>
</div>

<script>
  function setFilter(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      if (status === 'all' || card.dataset.status === status) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.card').forEach(card => {
      const text = card.dataset.search || '';
      card.style.display = text.includes(q) ? 'flex' : 'none';
    });
  });
</script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    // Health check endpoint
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('ok');
    }

    // JSON API: List all equipment
    if (req.method === 'GET' && req.url === '/api/equipment') {
      const items = await getInventory();
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(items));
    }

    // Web Dashboard Home
    if (req.method === 'GET' && req.url === '/') {
      const items = await getInventory();
      const logs = await getRecentLogs();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(renderHtml(items, logs));
    }

    // Checkout Action
    if (req.method === 'POST' && req.url === '/checkout') {
      const form = await readBody(req);
      const tag = (form.get('tag') || '').trim();
      const borrowerName = (form.get('borrower_name') || '').trim();
      const borrowerContact = (form.get('borrower_contact') || '').trim();
      const purpose = (form.get('purpose') || '').trim();

      if (!tag || !borrowerName) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        return res.end('Tag and borrower name are required.');
      }

      await pool.query(
        `UPDATE equipment 
         SET status = 'CHECKED_OUT', borrower_name = $1, borrower_contact = $2, purpose = $3, checked_out_at = now(), updated_at = now()
         WHERE tag = $4 AND status = 'AVAILABLE'`,
        [borrowerName, borrowerContact, purpose, tag]
      );

      await pool.query(
        `INSERT INTO checkout_history (tag, action, actor, purpose)
         VALUES ($1, 'CHECKOUT', $2, $3)`,
        [tag, borrowerName, purpose]
      );

      res.writeHead(303, { location: '/' });
      return res.end();
    }

    // Return Action
    if (req.method === 'POST' && req.url === '/return') {
      const form = await readBody(req);
      const tag = (form.get('tag') || '').trim();
      const actor = (form.get('actor') || 'Borrower').trim();

      if (!tag) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        return res.end('Tag is required.');
      }

      await pool.query(
        `UPDATE equipment 
         SET status = 'AVAILABLE', borrower_name = '', borrower_contact = '', purpose = '', checked_out_at = NULL, updated_at = now()
         WHERE tag = $1`,
        [tag]
      );

      await pool.query(
        `INSERT INTO checkout_history (tag, action, actor, purpose)
         VALUES ($1, 'RETURN', $2, 'Returned to locker/workbench')`,
        [tag, actor]
      );

      res.writeHead(303, { location: '/' });
      return res.end();
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

initDbAndSeed().finally(() => {
  server.listen(config.port, config.host, () => {
    console.log(`LabTrack running on http://${config.host}:${config.port}`);
  });
});

process.on('SIGTERM', () => {
  server.close(() => pool.end().then(() => process.exit(0)));
});

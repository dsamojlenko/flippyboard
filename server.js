const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const db = require('./lib/db');
const apiRouter = require('./lib/api');
const { createQueueManager } = require('./lib/queue');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());

// --- State ---
// Current display mode tracked in memory for reconnecting clients
let currentMode = { action: 'clear' };

// --- WebSocket ---
const wss = new WebSocketServer({ server });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

function setCurrentMode(msg) {
  currentMode = msg;
  broadcast(msg);
}

wss.on('connection', (ws) => {
  // Send current state on connect
  const settings = db.getAllSettings();
  ws.send(JSON.stringify({ action: 'sync', settings, currentMode }));
});

// --- Queue Manager ---
const queueManager = createQueueManager(db, setCurrentMode, broadcast);

// --- API ---
app.use('/api', apiRouter(db, setCurrentMode, broadcast, queueManager));

// --- Static files ---
// Serve original index.html at /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve display page
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Static assets
app.use('/shared', express.static(path.join(__dirname, 'public', 'shared')));
app.use('/display', express.static(path.join(__dirname, 'public', 'display')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

server.listen(PORT, () => {
  console.log(`Flippyboard server running on http://localhost:${PORT}`);
  console.log(`  Display: http://localhost:${PORT}/display`);
  console.log(`  Admin:   http://localhost:${PORT}/admin`);
  console.log(`  Original: http://localhost:${PORT}/`);
});

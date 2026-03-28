const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'flippyboard.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema creation
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    align_h TEXT DEFAULT 'center',
    align_v TEXT DEFAULT 'middle',
    fill_color TEXT,
    border_color TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position INTEGER NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS world_clock_cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    timezone TEXT NOT NULL,
    is_custom INTEGER DEFAULT 0,
    is_selected INTEGER DEFAULT 1
  );
`);

// ---------------------------------------------------------------------------
// Seed defaults (only when settings table is empty)
// ---------------------------------------------------------------------------

const settingsCount = db.prepare('SELECT COUNT(*) AS cnt FROM settings').get().cnt;

if (settingsCount === 0) {
  const defaultSettings = {
    rows: '6',
    cols: '22',
    is24h: 'false',
    fullFlip: 'true',
    soundDestination: 'display',
    queueDwellSec: '12',
    weatherUnit: 'F',
    weatherLat: 'null',
    weatherLon: 'null',
    weatherCity: '',
    weatherAutoRefresh: 'false',
    weatherRefreshMin: '15',
    clockTimezone: '',
    alignH: 'center',
    alignV: 'middle',
    fillColor: '',
    borderColor: '',
  };

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const seedSettings = db.transaction(() => {
    for (const [key, value] of Object.entries(defaultSettings)) {
      insertSetting.run(key, value);
    }
  });
  seedSettings();

  // Seed world clock cities
  const WORLD_CITIES = [
    { city: 'Tokyo, Japan', tz: 'Asia/Tokyo' },
    { city: 'London, England', tz: 'Europe/London' },
    { city: 'New York, USA', tz: 'America/New_York' },
    { city: 'Paris, France', tz: 'Europe/Paris' },
    { city: 'Sydney, Australia', tz: 'Australia/Sydney' },
    { city: 'Dubai, UAE', tz: 'Asia/Dubai' },
    { city: 'Singapore', tz: 'Asia/Singapore' },
    { city: 'Rome, Italy', tz: 'Europe/Rome' },
    { city: 'Cairo, Egypt', tz: 'Africa/Cairo' },
    { city: 'Mumbai, India', tz: 'Asia/Kolkata' },
    { city: 'Toronto, Canada', tz: 'America/Toronto' },
    { city: 'Berlin, Germany', tz: 'Europe/Berlin' },
    { city: 'S\u00e3o Paulo, Brazil', tz: 'America/Sao_Paulo' },
    { city: 'Mexico City, Mexico', tz: 'America/Mexico_City' },
    { city: 'Seoul, South Korea', tz: 'Asia/Seoul' },
    { city: 'Istanbul, Turkey', tz: 'Europe/Istanbul' },
    { city: 'Bangkok, Thailand', tz: 'Asia/Bangkok' },
    { city: 'Buenos Aires, Argentina', tz: 'America/Argentina/Buenos_Aires' },
    { city: 'Nairobi, Kenya', tz: 'Africa/Nairobi' },
    { city: 'Reykjavik, Iceland', tz: 'Atlantic/Reykjavik' },
  ];

  const insertCity = db.prepare(
    'INSERT INTO world_clock_cities (city, timezone, is_custom, is_selected) VALUES (?, ?, 0, 1)'
  );
  const seedCities = db.transaction(() => {
    for (const { city, tz } of WORLD_CITIES) {
      insertCity.run(city, tz);
    }
  });
  seedCities();

  // Seed default saved messages
  const insertMessage = db.prepare(
    'INSERT INTO saved_messages (name, text, align_h, align_v) VALUES (?, ?, ?, ?)'
  );
  const seedMessages = db.transaction(() => {
    insertMessage.run(
      'Welcome to Flippy Board',
      'Welcome to\nFlippy Board',
      'center',
      'middle'
    );
    insertMessage.run(
      'Menu',
      'Burger{<>}$14\nCheesburger{<>}$15\nFries{<>}$4\nMilkshake{<>}$5\nPop{<>}$2',
      'left',
      'top'
    );
  });
  seedMessages();

  // Seed default queue items
  const insertQueue = db.prepare(
    'INSERT INTO queue_items (position, type, config) VALUES (?, ?, ?)'
  );
  const seedQueue = db.transaction(() => {
    insertQueue.run(
      1,
      'text',
      JSON.stringify({ name: 'Welcome to Flippy Board', text: 'Welcome to\nFlippy Board' })
    );
    insertQueue.run(
      2,
      'text',
      JSON.stringify({
        name: 'Menu',
        text: 'Burger{<>}$14\nCheesburger{<>}$15\nFries{<>}$4\nMilkshake{<>}$5\nPop{<>}$2',
        alignH: 'left',
        alignV: 'top',
      })
    );
    insertQueue.run(3, 'clock', '{}');
    insertQueue.run(4, 'worldclock', '{}');
    insertQueue.run(5, 'weather', '{}');
  });
  seedQueue();
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const stmts = {
  getAllSettings: db.prepare('SELECT key, value FROM settings'),
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ),

  getSavedMessages: db.prepare('SELECT * FROM saved_messages ORDER BY id'),
  addSavedMessage: db.prepare(
    'INSERT INTO saved_messages (name, text, align_h, align_v, fill_color, border_color) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  deleteSavedMessage: db.prepare('DELETE FROM saved_messages WHERE id = ?'),
  clearSavedMessages: db.prepare('DELETE FROM saved_messages'),

  getQueueItems: db.prepare('SELECT * FROM queue_items ORDER BY position'),
  getMaxPosition: db.prepare('SELECT COALESCE(MAX(position), 0) AS maxPos FROM queue_items'),
  addQueueItem: db.prepare('INSERT INTO queue_items (position, type, config) VALUES (?, ?, ?)'),
  deleteQueueItem: db.prepare('DELETE FROM queue_items WHERE id = ?'),
  updateQueuePosition: db.prepare('UPDATE queue_items SET position = ? WHERE id = ?'),
  clearQueue: db.prepare('DELETE FROM queue_items'),

  getWorldClockCities: db.prepare('SELECT * FROM world_clock_cities ORDER BY id'),
  addWorldClockCity: db.prepare(
    'INSERT INTO world_clock_cities (city, timezone, is_custom, is_selected) VALUES (?, ?, ?, 1)'
  ),
  deleteWorldClockCity: db.prepare('DELETE FROM world_clock_cities WHERE id = ?'),
  setWorldClockCitySelected: db.prepare(
    'UPDATE world_clock_cities SET is_selected = ? WHERE id = ?'
  ),
  getSelectedWorldClockCities: db.prepare(
    'SELECT * FROM world_clock_cities WHERE is_selected = 1 ORDER BY id'
  ),
};

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

// --- Settings ---------------------------------------------------------------

function getAllSettings() {
  const rows = stmts.getAllSettings.all();
  const obj = {};
  for (const row of rows) {
    obj[row.key] = row.value;
  }
  return obj;
}

function getSetting(key) {
  const row = stmts.getSetting.get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  stmts.setSetting.run(key, value);
}

// --- Saved Messages ---------------------------------------------------------

function getSavedMessages() {
  return stmts.getSavedMessages.all();
}

function addSavedMessage({ name, text, alignH, alignV, fillColor, borderColor }) {
  const info = stmts.addSavedMessage.run(
    name,
    text,
    alignH || 'center',
    alignV || 'middle',
    fillColor || null,
    borderColor || null
  );
  return { id: info.lastInsertRowid };
}

function deleteSavedMessage(id) {
  stmts.deleteSavedMessage.run(id);
}

function clearSavedMessages() {
  stmts.clearSavedMessages.run();
}

// --- Queue ------------------------------------------------------------------

function getQueueItems() {
  return stmts.getQueueItems.all();
}

function addQueueItem({ type, config }) {
  const maxPos = stmts.getMaxPosition.get().maxPos;
  const info = stmts.addQueueItem.run(maxPos + 1, type, config || '{}');
  return { id: info.lastInsertRowid };
}

function deleteQueueItem(id) {
  stmts.deleteQueueItem.run(id);
  // Re-normalise positions so they remain contiguous 1..N
  const items = stmts.getQueueItems.all();
  const renormalize = db.transaction(() => {
    let pos = 1;
    for (const item of items) {
      stmts.updateQueuePosition.run(pos, item.id);
      pos++;
    }
  });
  renormalize();
}

function reorderQueue(ids) {
  const reorder = db.transaction(() => {
    for (let i = 0; i < ids.length; i++) {
      stmts.updateQueuePosition.run(i + 1, ids[i]);
    }
  });
  reorder();
}

function clearQueue() {
  stmts.clearQueue.run();
}

// --- World Clock Cities -----------------------------------------------------

function getWorldClockCities() {
  return stmts.getWorldClockCities.all();
}

function addWorldClockCity({ city, timezone, isCustom }) {
  const info = stmts.addWorldClockCity.run(city, timezone, isCustom ? 1 : 0);
  return { id: info.lastInsertRowid };
}

function deleteWorldClockCity(id) {
  stmts.deleteWorldClockCity.run(id);
}

function setWorldClockCitySelected(id, selected) {
  stmts.setWorldClockCitySelected.run(selected ? 1 : 0, id);
}

function getSelectedWorldClockCities() {
  return stmts.getSelectedWorldClockCities.all();
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  // Settings
  getAllSettings,
  getSetting,
  setSetting,

  // Saved messages
  getSavedMessages,
  addSavedMessage,
  deleteSavedMessage,
  clearSavedMessages,

  // Queue
  getQueueItems,
  addQueueItem,
  deleteQueueItem,
  reorderQueue,
  clearQueue,

  // World clock cities
  getWorldClockCities,
  addWorldClockCity,
  deleteWorldClockCity,
  setWorldClockCitySelected,
  getSelectedWorldClockCities,
};

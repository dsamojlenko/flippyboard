// StorageLocal — localStorage backend for standalone mode
// Mirrors the StorageAPI interface but stores everything in the browser.
// Display commands are dispatched via a callback to drive the local board.

const STORAGE_KEY = 'splitflap_state';

const WORLD_CITIES = [
  { city: 'Tokyo, Japan', timezone: 'Asia/Tokyo' },
  { city: 'London, England', timezone: 'Europe/London' },
  { city: 'New York, USA', timezone: 'America/New_York' },
  { city: 'Paris, France', timezone: 'Europe/Paris' },
  { city: 'Sydney, Australia', timezone: 'Australia/Sydney' },
  { city: 'Dubai, UAE', timezone: 'Asia/Dubai' },
  { city: 'Singapore', timezone: 'Asia/Singapore' },
  { city: 'Rome, Italy', timezone: 'Europe/Rome' },
  { city: 'Cairo, Egypt', timezone: 'Africa/Cairo' },
  { city: 'Mumbai, India', timezone: 'Asia/Kolkata' },
  { city: 'Toronto, Canada', timezone: 'America/Toronto' },
  { city: 'Berlin, Germany', timezone: 'Europe/Berlin' },
  { city: 'São Paulo, Brazil', timezone: 'America/Sao_Paulo' },
  { city: 'Mexico City, Mexico', timezone: 'America/Mexico_City' },
  { city: 'Seoul, South Korea', timezone: 'Asia/Seoul' },
  { city: 'Istanbul, Turkey', timezone: 'Europe/Istanbul' },
  { city: 'Bangkok, Thailand', timezone: 'Asia/Bangkok' },
  { city: 'Buenos Aires, Argentina', timezone: 'America/Argentina/Buenos_Aires' },
  { city: 'Nairobi, Kenya', timezone: 'Africa/Nairobi' },
  { city: 'Reykjavik, Iceland', timezone: 'Atlantic/Reykjavik' },
];

export class StorageLocal {
  constructor(onDisplayAction) {
    this._onDisplay = onDisplayAction;
    this._nextId = 1;
    this._queueTimeout = null;
    this._queueIdx = 0;
    this._queueBusy = false;
    this._state = this._load();
  }

  // --- Persistence ---

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        this._nextId = s._nextId || 100;
        const defaults = this._defaults();
        // Migrate from old standalone format if needed
        const migrated = this._migrate(s, defaults);
        return migrated;
      }
    } catch {}
    return this._defaults();
  }

  _migrate(s, defaults) {
    // Ensure all top-level keys exist
    if (!s.settings) {
      // Old format stored settings as top-level keys (rows, cols, etc.)
      s.settings = { ...defaults.settings };
      for (const key of Object.keys(defaults.settings)) {
        if (s[key] !== undefined) s.settings[key] = String(s[key]);
      }
      if (s.soundEnabled !== undefined) s.settings.soundEnabled = String(s.soundEnabled);
      if (s.is24h !== undefined) s.settings.is24h = String(s.is24h);
      if (s.fullFlip !== undefined) s.settings.fullFlip = String(s.fullFlip);
      if (s.clockTimezone !== undefined) s.settings.clockTimezone = s.clockTimezone;
      if (s.weather) {
        if (s.weather.lat != null) s.settings.weatherLat = String(s.weather.lat);
        if (s.weather.lon != null) s.settings.weatherLon = String(s.weather.lon);
        if (s.weather.city) s.settings.weatherCity = s.weather.city;
        if (s.weather.unit) s.settings.weatherUnit = s.weather.unit;
      }
    }

    // Ensure queueItems exists — migrate from old 'queue' array
    if (!s.queueItems) {
      if (Array.isArray(s.queue)) {
        s.queueItems = s.queue.map((item, idx) => {
          const id = this._nextId++;
          if (typeof item === 'object' && item.type) {
            // Old format: { type: 'clock' } or { type: 'saved', name, text, ... }
            const type = item.type === 'saved' ? 'text' : item.type;
            const config = {};
            if (item.name) config.name = item.name;
            if (item.text) config.text = item.text;
            if (item.alignH) config.alignH = item.alignH;
            if (item.alignV) config.alignV = item.alignV;
            if (item.fillColor) config.fillColor = item.fillColor;
            if (item.borderColor) config.borderColor = item.borderColor;
            return { id, position: idx + 1, type, config: JSON.stringify(config) };
          }
          return { id, position: idx + 1, type: 'text', config: '{}' };
        });
      } else {
        s.queueItems = [...defaults.queueItems];
      }
    }

    // Ensure savedMessages exists and has correct shape
    if (!s.savedMessages) {
      s.savedMessages = [...defaults.savedMessages];
    } else {
      // Migrate camelCase to snake_case if needed
      s.savedMessages = s.savedMessages.map(m => {
        if (!m.id) m.id = this._nextId++;
        if (m.alignH !== undefined && m.align_h === undefined) m.align_h = m.alignH;
        if (m.alignV !== undefined && m.align_v === undefined) m.align_v = m.alignV;
        if (m.fillColor !== undefined && m.fill_color === undefined) m.fill_color = m.fillColor;
        if (m.borderColor !== undefined && m.border_color === undefined) m.border_color = m.borderColor;
        if (!m.align_h) m.align_h = 'center';
        if (!m.align_v) m.align_v = 'middle';
        return m;
      });
    }

    // Ensure worldClockCities exists
    if (!s.worldClockCities) {
      s.worldClockCities = [...defaults.worldClockCities];
    }

    // Clean up old top-level keys
    delete s.queue;
    delete s.weather;

    return s;
  }

  _save() {
    this._state._nextId = this._nextId;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state)); } catch {}
  }

  _defaults() {
    const cities = WORLD_CITIES.map((c, i) => ({
      id: i + 1, city: c.city, timezone: c.timezone, is_custom: 0, is_selected: 1,
    }));
    this._nextId = cities.length + 1;

    const savedMessages = [
      { id: this._nextId++, name: 'Welcome to Flippy Board', text: 'Welcome to\nFlippy Board', align_h: 'center', align_v: 'middle', fill_color: null, border_color: null },
      { id: this._nextId++, name: 'Menu', text: 'Burger{<>}$14\nCheesburger{<>}$15\nFries{<>}$4\nMilkshake{<>}$5\nPop{<>}$2', align_h: 'left', align_v: 'top', fill_color: null, border_color: null },
    ];

    const queueItems = [
      { id: this._nextId++, position: 1, type: 'text', config: JSON.stringify({ name: 'Welcome to Flippy Board', text: 'Welcome to\nFlippy Board' }) },
      { id: this._nextId++, position: 2, type: 'text', config: JSON.stringify({ name: 'Menu', text: 'Burger{<>}$14\nCheesburger{<>}$15\nFries{<>}$4\nMilkshake{<>}$5\nPop{<>}$2', alignH: 'left', alignV: 'top' }) },
      { id: this._nextId++, position: 3, type: 'clock', config: '{}' },
      { id: this._nextId++, position: 4, type: 'worldclock', config: '{}' },
      { id: this._nextId++, position: 5, type: 'weather', config: '{}' },
    ];

    return {
      settings: {
        rows: '6', cols: '22', is24h: 'false', fullFlip: 'true',
        soundEnabled: 'true', queueDwellSec: '12',
        weatherUnit: 'F', weatherLat: 'null', weatherLon: 'null', weatherCity: '',
        weatherAutoRefresh: 'false', weatherRefreshMin: '15',
        clockTimezone: '', alignH: 'center', alignV: 'middle',
        fillColor: '', borderColor: '',
      },
      savedMessages,
      queueItems,
      worldClockCities: cities,
    };
  }

  // --- Settings ---

  async getSettings() {
    return { ...this._state.settings };
  }

  async updateSettings(patch) {
    Object.assign(this._state.settings, patch);
    this._save();
    this._onDisplay({ action: 'updateSettings', settings: { ...this._state.settings } });
    return { ...this._state.settings };
  }

  // --- Saved Messages ---

  async getMessages() {
    return [...this._state.savedMessages];
  }

  async addMessage({ name, text, alignH, alignV, fillColor, borderColor }) {
    const id = this._nextId++;
    this._state.savedMessages.push({
      id, name, text,
      align_h: alignH || 'center',
      align_v: alignV || 'middle',
      fill_color: fillColor || null,
      border_color: borderColor || null,
    });
    this._save();
    return { id };
  }

  async deleteMessage(id) {
    this._state.savedMessages = this._state.savedMessages.filter(m => m.id !== id);
    this._save();
    return { ok: true };
  }

  async clearMessages() {
    this._state.savedMessages = [];
    this._save();
    return { ok: true };
  }

  // --- Queue Items ---

  async getQueueItems() {
    return [...this._state.queueItems];
  }

  async addQueueItem({ type, config }) {
    const id = this._nextId++;
    const maxPos = this._state.queueItems.reduce((m, i) => Math.max(m, i.position), 0);
    this._state.queueItems.push({ id, position: maxPos + 1, type, config: config || '{}' });
    this._save();
    return { id };
  }

  async deleteQueueItem(id) {
    this._state.queueItems = this._state.queueItems.filter(i => i.id !== id);
    this._state.queueItems.forEach((item, idx) => { item.position = idx + 1; });
    this._save();
    return { ok: true };
  }

  async clearQueue() {
    this._stopLocalQueue();
    this._state.queueItems = [];
    this._save();
    return { ok: true };
  }

  async reorderQueue(ids) {
    const byId = new Map(this._state.queueItems.map(i => [i.id, i]));
    this._state.queueItems = ids.map((id, idx) => {
      const item = byId.get(id);
      if (item) item.position = idx + 1;
      return item;
    }).filter(Boolean);
    this._save();
    return { ok: true };
  }

  // --- Queue Control (local timer) ---

  async startQueue() {
    const items = this._state.queueItems;
    if (items.length === 0) return { ok: true };
    this._queueIdx = 0;
    this._queueTimeout = -1; // sentinel: active
    this._onDisplay({ action: 'queueStatus', running: true, currentIndex: 0 });
    await this._showQueueItem();
    this._scheduleNextQueueItem();
    return { ok: true };
  }

  async stopQueue() {
    this._stopLocalQueue();
    return { ok: true };
  }

  _stopLocalQueue() {
    if (this._queueTimeout !== null) { clearTimeout(this._queueTimeout); this._queueTimeout = null; }
    this._onDisplay({ action: 'queueStatus', running: false, currentIndex: 0 });
  }

  _scheduleNextQueueItem() {
    if (this._queueTimeout === null) return;
    const sec = parseInt(this._state.settings.queueDwellSec) || 12;
    this._queueTimeout = setTimeout(async () => {
      if (this._queueTimeout === null) return;
      this._queueIdx = (this._queueIdx + 1) % this._state.queueItems.length;
      this._onDisplay({ action: 'queueStatus', running: true, currentIndex: this._queueIdx });
      await this._showQueueItem();
      this._scheduleNextQueueItem();
    }, sec * 1000);
  }

  async _showQueueItem() {
    const items = this._state.queueItems;
    if (items.length === 0 || this._queueBusy) return;
    const item = items[this._queueIdx];
    const config = JSON.parse(item.config || '{}');
    const s = this._state.settings;

    if (item.type === 'clock') {
      this._onDisplay({ action: 'startClock', is24h: s.is24h === 'true', timezone: s.clockTimezone || '' });
    } else if (item.type === 'worldclock') {
      const selected = this._state.worldClockCities.filter(c => c.is_selected);
      const cities = selected.map(c => ({ city: c.city, tz: c.timezone }));
      this._onDisplay({ action: 'startWorldClock', cities, is24h: s.is24h === 'true' });
    } else if (item.type === 'weather') {
      this._queueBusy = true;
      try {
        await this._fetchAndShowWeather();
      } finally { this._queueBusy = false; }
    } else {
      // text
      this._onDisplay({
        action: 'setText',
        text: config.text || '',
        alignH: config.alignH || 'center',
        alignV: config.alignV || 'middle',
        fillColor: config.fillColor || null,
        borderColor: config.borderColor || null,
      });
    }
  }

  async _fetchAndShowWeather() {
    const s = this._state.settings;
    const lat = parseFloat(s.weatherLat);
    const lon = parseFloat(s.weatherLon);
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
    const unit = s.weatherUnit || 'F';
    const tempUnit = unit === 'C' ? 'celsius' : 'fahrenheit';
    const windUnit = unit === 'C' ? 'kmh' : 'mph';
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}` +
      `&timezone=auto&forecast_days=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    this._onDisplay({ action: 'showWeather', city: s.weatherCity || 'LOCAL', data, unit });
  }

  // --- Display Commands ---

  async displayText({ text, alignH, alignV, fillColor, borderColor }) {
    this._stopLocalQueue();
    this._onDisplay({ action: 'setText', text, alignH, alignV, fillColor, borderColor });
    return { ok: true };
  }

  async displayClear() {
    this._stopLocalQueue();
    this._onDisplay({ action: 'clear' });
    return { ok: true };
  }

  async displayClock({ is24h, timezone }) {
    this._stopLocalQueue();
    this._onDisplay({ action: 'startClock', is24h, timezone });
    return { ok: true };
  }

  async displayWorldClock({ cities, is24h }) {
    this._stopLocalQueue();
    this._onDisplay({ action: 'startWorldClock', cities, is24h });
    return { ok: true };
  }

  async displayWeather({ city, lat, lon, unit }) {
    this._stopLocalQueue();
    const tempUnit = unit === 'C' ? 'celsius' : 'fahrenheit';
    const windUnit = unit === 'C' ? 'kmh' : 'mph';
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}` +
      `&timezone=auto&forecast_days=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    this._onDisplay({ action: 'showWeather', city, data, unit });
    return { ok: true };
  }

  // --- World Clock Cities ---

  async getWorldClockCities() {
    return [...this._state.worldClockCities];
  }

  async addWorldClockCity({ city, timezone, isCustom }) {
    const id = this._nextId++;
    this._state.worldClockCities.push({ id, city, timezone, is_custom: isCustom ? 1 : 0, is_selected: 1 });
    this._save();
    return { id };
  }

  async deleteWorldClockCity(id) {
    this._state.worldClockCities = this._state.worldClockCities.filter(c => c.id !== id);
    this._save();
    return { ok: true };
  }

  async updateWorldClockCity(id, { selected }) {
    const city = this._state.worldClockCities.find(c => c.id === id);
    if (city) {
      city.is_selected = selected ? 1 : 0;
      this._save();
    }
    return { ok: true };
  }

  // --- Weather reverse geocode (direct, no server proxy) ---

  async reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'FlippyBoard/1.0' } });
    const data = await resp.json();
    const address = data.address || {};
    const city = address.city || address.town || address.village || address.hamlet || address.county || '';
    return { lat, lon, city };
  }
}

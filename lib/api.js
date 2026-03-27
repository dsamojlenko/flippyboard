// REST API router for FlippyBoard
// Requires Node 18+ for built-in fetch

const express = require('express');

module.exports = function (db, setCurrentMode, broadcast, queueManager) {
  const router = express.Router();

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  router.get('/settings', (req, res) => {
    try {
      const settings = db.getAllSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/settings', (req, res) => {
    try {
      const body = req.body;
      for (const [key, value] of Object.entries(body)) {
        db.setSetting(key, String(value));
      }
      const settings = db.getAllSettings();
      broadcast({ action: 'updateSettings', settings });
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Saved Messages
  // ---------------------------------------------------------------------------

  router.get('/messages', (req, res) => {
    try {
      const messages = db.getSavedMessages();
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/messages', (req, res) => {
    try {
      const { name, text, alignH, alignV, fillColor, borderColor } = req.body;
      const result = db.addSavedMessage({ name, text, alignH, alignV, fillColor, borderColor });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/messages/all', (req, res) => {
    try {
      db.clearSavedMessages();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/messages/:id', (req, res) => {
    try {
      db.deleteSavedMessage(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Queue
  // ---------------------------------------------------------------------------

  router.get('/queue/items', (req, res) => {
    try {
      const items = db.getQueueItems();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/queue/items', (req, res) => {
    try {
      const { type, config } = req.body;
      const result = db.addQueueItem({ type, config });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/queue/items/all', (req, res) => {
    try {
      queueManager.stop();
      db.clearQueue();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/queue/items/:id', (req, res) => {
    try {
      db.deleteQueueItem(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/queue/reorder', (req, res) => {
    try {
      const { ids } = req.body;
      db.reorderQueue(ids);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/queue/start', (req, res) => {
    try {
      queueManager.start();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/queue/stop', (req, res) => {
    try {
      queueManager.stop();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Display
  // ---------------------------------------------------------------------------

  router.post('/display/text', (req, res) => {
    try {
      const { text, alignH, alignV, fillColor, borderColor } = req.body;
      queueManager.stop();
      setCurrentMode({ action: 'setText', text, alignH, alignV, fillColor, borderColor });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/display/clear', (req, res) => {
    try {
      queueManager.stop();
      setCurrentMode({ action: 'clear' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/display/clock', (req, res) => {
    try {
      const { is24h, timezone } = req.body;
      queueManager.stop();
      setCurrentMode({ action: 'startClock', is24h: !!is24h, timezone: timezone || '' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/display/worldclock', (req, res) => {
    try {
      let { cities, is24h } = req.body;
      if (!cities) {
        cities = db.getSelectedWorldClockCities();
      }
      queueManager.stop();
      setCurrentMode({ action: 'startWorldClock', cities, is24h: !!is24h });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/display/weather', async (req, res) => {
    try {
      const { city, lat, lon, unit } = req.body;
      const tempUnit = unit === 'C' ? 'celsius' : 'fahrenheit';
      const windUnit = unit === 'C' ? 'kmh' : 'mph';
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
        `&daily=temperature_2m_max,temperature_2m_min` +
        `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}` +
        `&timezone=auto&forecast_days=1`;

      const response = await fetch(url);
      const weatherData = await response.json();

      queueManager.stop();
      setCurrentMode({ action: 'showWeather', city, data: weatherData, unit });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Weather helpers
  // ---------------------------------------------------------------------------

  router.get('/weather/search', async (req, res) => {
    try {
      const city = req.query.city;
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data.results || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/weather/location', async (req, res) => {
    try {
      const { lat, lon } = req.body;
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'FlippyBoard/1.0' },
      });
      const data = await response.json();
      const address = data.address || {};
      const name = address.city || address.town || address.village || address.hamlet || address.county || '';
      res.json({ lat, lon, city: name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // World Clock Cities
  // ---------------------------------------------------------------------------

  router.get('/worldclock/cities', (req, res) => {
    try {
      const cities = db.getWorldClockCities();
      res.json(cities);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/worldclock/cities', (req, res) => {
    try {
      const { city, timezone, isCustom } = req.body;
      const result = db.addWorldClockCity({ city, timezone, isCustom });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/worldclock/cities/:id', (req, res) => {
    try {
      db.deleteWorldClockCity(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/worldclock/cities/:id', (req, res) => {
    try {
      const { selected } = req.body;
      db.setWorldClockCitySelected(req.params.id, selected);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// lib/queue.js
module.exports = { createQueueManager };

function createQueueManager(db, setCurrentMode, broadcast) {
  let running = false;
  let currentIndex = 0;
  let timer = null;
  let weatherCache = null; // { data, city, unit, fetchedAt }

  function start() {
    const items = db.getQueueItems();
    if (items.length === 0) return;
    running = true;
    currentIndex = 0;
    broadcastStatus();
    showCurrentItem();
  }

  function stop() {
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    broadcastStatus();
  }

  function isRunning() { return running; }
  function getCurrentIndex() { return currentIndex; }

  function broadcastStatus() {
    broadcast({ action: 'queueStatus', running, currentIndex });
  }

  async function showCurrentItem() {
    if (!running) return;
    const items = db.getQueueItems();
    if (items.length === 0) { stop(); return; }
    if (currentIndex >= items.length) currentIndex = 0;

    const item = items[currentIndex];
    const config = JSON.parse(item.config || '{}');
    const settings = db.getAllSettings();

    if (item.type === 'clock') {
      setCurrentMode({
        action: 'startClock',
        is24h: settings.is24h === 'true',
        timezone: settings.clockTimezone || ''
      });
    } else if (item.type === 'worldclock') {
      const cities = db.getSelectedWorldClockCities();
      setCurrentMode({
        action: 'startWorldClock',
        cities: cities.map(c => ({ city: c.city, tz: c.timezone })),
        is24h: settings.is24h === 'true'
      });
    } else if (item.type === 'weather') {
      // Fetch weather server-side
      const lat = settings.weatherLat;
      const lon = settings.weatherLon;
      const city = settings.weatherCity || 'LOCAL';
      const unit = settings.weatherUnit || 'F';

      if (lat && lon && lat !== 'null' && lon !== 'null') {
        try {
          const tempUnit = unit === 'C' ? 'celsius' : 'fahrenheit';
          const windUnit = unit === 'C' ? 'kmh' : 'mph';
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=1`;
          const resp = await fetch(url);
          const data = await resp.json();
          weatherCache = { data, city, unit, fetchedAt: Date.now() };
          setCurrentMode({ action: 'showWeather', city, data, unit });
        } catch (e) {
          console.error('Queue weather fetch error:', e.message);
          // Skip to next item on error
          scheduleNext();
          return;
        }
      } else {
        // No location set, skip
        scheduleNext();
        return;
      }
    } else {
      // text type
      setCurrentMode({
        action: 'setText',
        text: config.text || '',
        alignH: config.alignH || 'center',
        alignV: config.alignV || 'middle',
        fillColor: config.fillColor || null,
        borderColor: config.borderColor || null
      });
    }

    broadcastStatus();
    scheduleNext();
  }

  function scheduleNext() {
    if (!running) return;
    const dwellSec = parseInt(db.getSetting('queueDwellSec')) || 12;
    timer = setTimeout(() => {
      const items = db.getQueueItems();
      if (items.length === 0) { stop(); return; }
      currentIndex = (currentIndex + 1) % items.length;
      showCurrentItem();
    }, dwellSec * 1000);
  }

  return { start, stop, isRunning, getCurrentIndex, broadcastStatus };
}

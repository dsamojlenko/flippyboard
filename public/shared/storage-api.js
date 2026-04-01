// StorageAPI — REST backend for admin mode
// Every method maps to an existing /api endpoint

export class StorageAPI {
  async _api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    return res.json();
  }

  // Settings
  async getSettings() { return this._api('GET', '/settings'); }
  async updateSettings(patch) { return this._api('PATCH', '/settings', patch); }

  // Saved Messages
  async getMessages() { return this._api('GET', '/messages'); }
  async addMessage(msg) { return this._api('POST', '/messages', msg); }
  async deleteMessage(id) { return this._api('DELETE', '/messages/' + id); }
  async clearMessages() { return this._api('DELETE', '/messages/all'); }

  // Queue Items
  async getQueueItems() { return this._api('GET', '/queue/items'); }
  async addQueueItem(item) { return this._api('POST', '/queue/items', item); }
  async deleteQueueItem(id) { return this._api('DELETE', '/queue/items/' + id); }
  async clearQueue() { return this._api('DELETE', '/queue/items/all'); }
  async reorderQueue(ids) { return this._api('PUT', '/queue/reorder', { ids }); }

  // Queue Control
  async startQueue() { return this._api('POST', '/queue/start'); }
  async stopQueue() { return this._api('POST', '/queue/stop'); }

  // Display Commands
  async displayText(params) { return this._api('POST', '/display/text', params); }
  async displayClear() { return this._api('POST', '/display/clear'); }
  async displayClock(params) { return this._api('POST', '/display/clock', params); }
  async displayWorldClock(params) { return this._api('POST', '/display/worldclock', params); }
  async displayWeather(params) { return this._api('POST', '/display/weather', params); }

  // World Clock Cities
  async getWorldClockCities() { return this._api('GET', '/worldclock/cities'); }
  async addWorldClockCity(city) { return this._api('POST', '/worldclock/cities', city); }
  async deleteWorldClockCity(id) { return this._api('DELETE', '/worldclock/cities/' + id); }
  async updateWorldClockCity(id, patch) { return this._api('PATCH', '/worldclock/cities/' + id, patch); }

  // Weather reverse geocode (proxied through server)
  async reverseGeocode(lat, lon) { return this._api('POST', '/weather/location', { lat, lon }); }
}

# Flippy Board

A split-flap display simulator in a single HTML file. No build tools, no dependencies, no API keys required.

Open `index.html` in any modern browser to get started.

## Features

### Text Display
- Type a message and send it to the board with animated split-flap tile transitions
- Supports word wrapping, horizontal alignment (left/center/right), and vertical alignment (top/middle/bottom)
- Color tiles: insert `{R}` `{O}` `{Y}` `{G}` `{B}` `{V}` `{W}` for red, orange, yellow, green, blue, violet, and white solid tiles
- Apply fill (color all empty tiles) or border (wrap message in a colored frame) from the color pickers
- Configurable board size (rows and columns)
- Full flip mode: optionally flip through every intermediate character for a more authentic feel

### Saved Messages
- Save any message with a custom name for quick recall
- Click a saved message to load it back into the editor
- Saved messages persist across page reloads

### Clock
- Live clock display with time, day, and date
- 12-hour or 24-hour format
- Optional timezone override — type a city name to search and select, or enter an IANA timezone string manually

### World Clock
- Show current times for multiple cities around the world, one per row
- Choose from 20 built-in cities or add custom ones
- City autocomplete powered by Open-Meteo geocoding — type a city name to search, and the timezone is filled in automatically
- Randomize button for a fresh selection

### Weather
- Current conditions displayed on the board: temperature, condition, high/low, wind, humidity
- Search by city name or auto-detect location via browser geolocation
- Fahrenheit or Celsius
- Optional auto-refresh interval
- Powered by [Open-Meteo](https://open-meteo.com/) (free, no API key)

### Message Queue
- Build a rotation of items: text messages, saved messages, clock, world clock, or weather
- Configurable rotation interval
- Mix and match different types in a single queue

### Sound
- Authentic flip sound sampled from a real Vestaboard
- Toggle on/off from the toolbar

### Persistence
All settings and data are saved to `localStorage` and restored on reload:
board size, alignment, sound, clock format, timezone, world clock cities, weather location/unit, saved messages, and queue contents. Export and import configuration as JSON from the Settings tab.

### API
Control the board programmatically from other scripts on the same origin:

```js
const ch = new BroadcastChannel('splitflap');
ch.postMessage({ text: 'HELLO WORLD' });
ch.postMessage({ rows: ['LINE ONE', 'LINE TWO'] });
ch.postMessage({ clear: true });
```

Or via `postMessage` when embedding in an iframe.

## Audio Attribution

The flip sound sample is from [robonyong/react-split-flap-display](https://github.com/robonyong/react-split-flap-display) (MIT License).

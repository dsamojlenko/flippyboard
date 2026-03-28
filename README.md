<p align="center">
  <img src="flippyboard.png" alt="Flippy Board" width="400">
</p>

A split-flap display simulator with a Node.js server, separate display and admin pages, and real-time sync via WebSocket. No build tools or API keys required.

## Getting Started

```bash
npm install
node server.js
```

Open `http://localhost:3000/admin` to manage the board and `http://localhost:3000/display` on a second screen or window to show the board.

The standalone `index.html` is also available at `http://localhost:3000/` and works independently without the server.

**Requirements:** Node.js 18+

## Architecture

- **Display** (`/display`) — passive board that receives commands via WebSocket
- **Admin** (`/admin`) — full management UI, sends commands via REST API
- **Server** — Express + better-sqlite3 + ws; broadcasts state changes to all connected clients
- **Database** — SQLite file at `data/flippyboard.db`, created automatically on first run

## Features

### Text Display
- Animated split-flap tile transitions with authentic flip sound
- Word wrapping, horizontal alignment (left/center/right), vertical alignment (top/middle/bottom)
- Color tiles: insert `{R}` `{O}` `{Y}` `{G}` `{B}` `{V}` `{W}` for red, orange, yellow, green, blue, violet, and white
- Formatting codes (available from the Insert dropdown):
  - `{<>}` — justify (push left and right text apart to fill the row)
  - `{TAB}` — dynamic tab columns (divides the row into equal columns based on number of tabs)
  - `{HR}` — horizontal rule (fills an entire line with dashes)
  - `{<}` — left-align this line (per-line override)
  - `{C}` — center this line (per-line override)
  - `{>}` — right-align this line (per-line override)
- Fill (color empty tiles) and border (colored frame) from color pickers
- Configurable board size (rows and columns)
- Full flip mode: flip through every intermediate character

### Saved Messages
- Save messages with custom names for quick recall
- Click to load back into the editor

### Clock
- Live clock with time, day, and date
- 12-hour or 24-hour format
- Optional timezone override with city autocomplete

### World Clock
- Current times for multiple cities, one per row
- 20 built-in cities plus custom entries
- City autocomplete powered by Open-Meteo geocoding
- Randomize button for a fresh selection

### Weather
- Current conditions: temperature, condition, high/low, wind, humidity
- Search by city or auto-detect via browser geolocation
- Fahrenheit or Celsius
- Powered by [Open-Meteo](https://open-meteo.com/) (free, no API key)

### Message Queue
- Rotation of text messages, clock, world clock, and weather
- Configurable dwell time
- Drag-to-reorder

### Sound
- Authentic flip sound sampled from a real Vestaboard
- Sound destination routing: **Display**, **Admin**, **Both**, or **Off** — prevents double audio when both pages are open
- Display page initializes audio eagerly; click the display page once if your browser requires user interaction to enable sound

### Persistence
All settings, saved messages, queue items, and world clock cities are stored in SQLite and persist across restarts. Export and import configuration as JSON from the Settings tab.

### REST API

The server exposes a REST API at `/api`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get all settings |
| `PATCH` | `/settings` | Update settings (broadcasts to all clients) |
| `POST` | `/display/text` | Send text to the board |
| `POST` | `/display/clear` | Clear the board |
| `POST` | `/display/clock` | Start the clock |
| `POST` | `/display/worldclock` | Start the world clock |
| `POST` | `/display/weather` | Fetch and display weather |
| `GET` | `/messages` | List saved messages |
| `POST` | `/messages` | Save a message |
| `GET` | `/queue/items` | List queue items |
| `POST` | `/queue/start` | Start queue rotation |
| `POST` | `/queue/stop` | Stop queue rotation |

## Audio Attribution

The flip sound sample is from [robonyong/react-split-flap-display](https://github.com/robonyong/react-split-flap-display) (MIT License).

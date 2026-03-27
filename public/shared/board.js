import { CHARS, CHAR_SET, COLOR_TILES, CODE_TO_COLOR, sanitize, parseColorCodes, expandJustify, WMO_CODES } from './chars.js';
import { playClick } from './audio.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class Tile {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'tile';
    this.currentChar = ' ';
    this.flipping = false;
    this._aborted = false;
    this._flipGen = 0;

    this.upper = this._half('upper');
    this.lower = this._half('lower');
    this.flapTop = this._flap('flap-top');
    this.flapBottom = this._flap('flap-bottom');

    this.el.append(this.upper.el, this.lower.el, this.flapTop.el, this.flapBottom.el);
    this._display(this.currentChar);
  }

  _half(cls) {
    const el = document.createElement('div');
    el.className = `half ${cls}`;
    const ch = document.createElement('div');
    ch.className = 'ch';
    ch.textContent = ' ';
    el.appendChild(ch);
    return { el, ch };
  }

  _flap(cls) {
    const el = document.createElement('div');
    el.className = `flap ${cls}`;
    const ch = document.createElement('div');
    ch.className = 'ch';
    ch.textContent = ' ';
    el.appendChild(ch);
    return { el, ch };
  }

  _display(c) {
    this.currentChar = c;
    const color = COLOR_TILES[c];
    if (color) {
      this.upper.ch.textContent = '';
      this.lower.ch.textContent = '';
      this.upper.el.style.background = color.upper;
      this.lower.el.style.background = color.lower;
      this.el.classList.add('color-tile');
    } else {
      this.upper.ch.textContent = c;
      this.lower.ch.textContent = c;
      this.upper.el.style.background = '';
      this.lower.el.style.background = '';
      this.el.classList.remove('color-tile');
    }
  }

  abort() {
    this._aborted = true;
    this._flipGen++;
  }

  forceReset() {
    this._flipGen++;
    this.flapTop.el.classList.remove('flip');
    this.flapBottom.el.classList.remove('flip');
    this.flapTop.el.style.background = '';
    this.flapBottom.el.style.background = '';
    this._display(this.currentChar);
    this.flipping = false;
  }

  // NOTE: fullFlip is now a parameter, not a global
  async flipTo(target, delay = 0, fullFlip = false) {
    target = sanitize(target);
    if (target === this.currentChar && !this.flipping) return;

    this._aborted = false;

    if (delay > 0) await sleep(delay);
    if (this._aborted) return;

    const curIdx = CHARS.indexOf(this.currentChar);
    const tgtIdx = CHARS.indexOf(target);
    if (curIdx === tgtIdx) return;

    const dist = (tgtIdx - curIdx + CHARS.length) % CHARS.length;
    let steps = [];

    if (fullFlip || dist <= 5) {
      for (let i = 1; i <= dist; i++) steps.push(CHARS[(curIdx + i) % CHARS.length]);
    } else {
      const count = Math.min(4, dist - 1);
      for (let i = 1; i <= count; i++) {
        steps.push(CHARS[(curIdx + Math.floor(i * dist / (count + 1))) % CHARS.length]);
      }
      steps.push(target);
    }

    this.flipping = true;
    for (const c of steps) {
      if (this._aborted) break;
      await this._flipOnce(c);
    }
    this.flipping = false;
  }

  _flipOnce(newChar) {
    return new Promise(resolve => {
      const gen = this._flipGen;
      const oldChar = this.currentChar;
      const oldColor = COLOR_TILES[oldChar];
      const newColor = COLOR_TILES[newChar];

      if (newColor) {
        this.upper.ch.textContent = '';
        this.upper.el.style.background = newColor.upper;
      } else {
        this.upper.ch.textContent = newChar;
        this.upper.el.style.background = '';
      }

      if (oldColor) {
        this.flapTop.ch.textContent = '';
        this.flapTop.el.style.background = oldColor.upper;
      } else {
        this.flapTop.ch.textContent = oldChar;
        this.flapTop.el.style.background = '';
      }

      if (newColor) {
        this.flapBottom.ch.textContent = '';
        this.flapBottom.el.style.background = newColor.lower;
      } else {
        this.flapBottom.ch.textContent = newChar;
        this.flapBottom.el.style.background = '';
      }

      this.flapTop.el.classList.add('flip');

      let p1Done = false;
      let p1Timer;
      const onP1 = () => {
        if (p1Done) return;
        p1Done = true;
        clearTimeout(p1Timer);
        this.flapTop.el.removeEventListener('animationend', onP1);
        if (this._flipGen !== gen) { resolve(); return; }
        this.flapTop.el.classList.remove('flip');
        this.flapTop.el.style.background = '';
        playClick();

        this.flapBottom.el.classList.add('flip');

        let p2Done = false;
        let p2Timer;
        const onP2 = () => {
          if (p2Done) return;
          p2Done = true;
          clearTimeout(p2Timer);
          this.flapBottom.el.removeEventListener('animationend', onP2);
          if (this._flipGen !== gen) { resolve(); return; }
          this.flapBottom.el.classList.remove('flip');
          this.flapBottom.el.style.background = '';
          this._display(newChar);
          resolve();
        };
        this.flapBottom.el.addEventListener('animationend', onP2);
        p2Timer = setTimeout(onP2, 200);
      };
      this.flapTop.el.addEventListener('animationend', onP1);
      p1Timer = setTimeout(onP1, 200);
    });
  }
}

export class Board {
  constructor(boardEl, options = {}) {
    this.boardEl = boardEl;
    this.rows = options.rows || 6;
    this.cols = options.cols || 22;
    this.fullFlip = options.fullFlip !== undefined ? options.fullFlip : false;
    this.tiles = [];
    this.build();
  }

  build() {
    this.boardEl.innerHTML = '';
    this.tiles = [];
    this.boardEl.style.gridTemplateColumns = `repeat(${this.cols}, var(--tw))`;

    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const tile = new Tile();
        this.tiles[r][c] = tile;
        this.boardEl.appendChild(tile.el);
      }
    }
    this.sizeTiles();
  }

  sizeTiles(isFullscreen) {
    if (isFullscreen === undefined) isFullscreen = !!document.fullscreenElement;
    const maxW = isFullscreen
      ? window.innerWidth - 60
      : Math.min(window.innerWidth - 80, 1160);
    const maxH = isFullscreen
      ? window.innerHeight - 40
      : window.innerHeight * 0.55;

    const gapTotal = (this.cols - 1) * 3;
    let tw = Math.floor((maxW - gapTotal) / this.cols);
    let th = Math.round(tw * 1.42);

    const totalH = th * this.rows + (this.rows - 1) * 3;
    if (totalH > maxH) {
      th = Math.floor((maxH - (this.rows - 1) * 3) / this.rows);
      tw = Math.round(th / 1.42);
    }

    tw = Math.max(tw, 20);
    th = Math.max(th, 28);

    document.documentElement.style.setProperty('--tw', tw + 'px');
    document.documentElement.style.setProperty('--th', th + 'px');
  }

  abortAll() {
    for (const row of this.tiles) for (const t of row) t.abort();
  }

  setBoard(lines) {
    this.abortAll();
    const promises = [];
    for (let r = 0; r < this.rows; r++) {
      const line = (lines[r] || '').toUpperCase();
      for (let c = 0; c < this.cols; c++) {
        const ch = c < line.length ? sanitize(line[c]) : ' ';
        const delay = r * 18 + c * 28;
        promises.push(this.tiles[r][c].flipTo(ch, delay, this.fullFlip));
      }
    }
    return Promise.all(promises);
  }

  setBoardText(text, hAlign = 'center', vAlign = 'middle', fill = null, border = null) {
    let padded;

    const applyFillToLines = (lines, width) => {
      const fillChar = CODE_TO_COLOR[fill];
      return lines.map(line => {
        const content = line.replace(/\s+$/, '');
        const contentStart = content.search(/\S/);
        if (contentStart === -1) return fillChar.repeat(line.length > 0 ? line.length : width);
        const leading = fillChar.repeat(contentStart);
        const trailing = fillChar.repeat(Math.max(0, line.length - content.length));
        return leading + content.slice(contentStart) + trailing;
      });
    };

    if (border) {
      const borderChar = CODE_TO_COLOR[border];
      const innerCols = this.cols - 2;
      const innerRows = this.rows - 2;
      let innerLines = Board.layoutLines(text, innerCols, innerRows, hAlign, vAlign);
      if (fill) innerLines = applyFillToLines(innerLines, innerCols);
      padded = [];
      padded.push(borderChar.repeat(this.cols));
      for (const line of innerLines) padded.push(borderChar + line + borderChar);
      padded.push(borderChar.repeat(this.cols));
    } else {
      padded = Board.layoutLines(text, this.cols, this.rows, hAlign, vAlign);
      if (fill) padded = applyFillToLines(padded, this.cols);
    }

    return this.setBoard(padded);
  }

  clearBoard() {
    return this.setBoard(Array(this.rows).fill(''));
  }

  forceResetAll() {
    for (const row of this.tiles) for (const t of row) t.forceReset();
  }

  resize(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.build();
  }

  static wordWrap(text, width) {
    const paragraphs = text.split('\n');
    const result = [];
    for (const para of paragraphs) {
      if (para.trim() === '') { result.push(''); continue; }
      if (para.length <= width) { result.push(para); continue; }
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const word of words) {
        if (word.length > width) {
          if (line) { result.push(line); line = ''; }
          for (let i = 0; i < word.length; i += width) {
            result.push(word.slice(i, i + width));
          }
          continue;
        }
        if (line && line.length + 1 + word.length > width) {
          result.push(line);
          line = word;
        } else {
          line = line ? line + ' ' + word : word;
        }
      }
      if (line) result.push(line);
    }
    return result;
  }

  static layoutLines(text, numCols, numRows, hAlign, vAlign) {
    text = parseColorCodes(text);
    text = expandJustify(text, numCols);
    const lines = Board.wordWrap(text.toUpperCase(), numCols);

    const aligned = lines.map(line => {
      if (line.length >= numCols) return line.slice(0, numCols);
      const gap = numCols - line.length;
      if (hAlign === 'center') {
        const left = Math.floor(gap / 2);
        return ' '.repeat(left) + line + ' '.repeat(gap - left);
      } else if (hAlign === 'right') {
        return ' '.repeat(gap) + line;
      }
      return line + ' '.repeat(gap);
    });

    let padTop = 0;
    if (aligned.length < numRows) {
      if (vAlign === 'middle') padTop = Math.floor((numRows - aligned.length) / 2);
      else if (vAlign === 'bottom') padTop = numRows - aligned.length;
    }

    const result = [];
    for (let i = 0; i < numRows; i++) {
      let line = i >= padTop && i < padTop + aligned.length ? aligned[i - padTop] : '';
      if (line.length < numCols) line += ' '.repeat(numCols - line.length);
      result.push(line);
    }
    return result;
  }
}

// --- Formatting helpers used by both display and admin ---

export function formatClockLines(rows, cols, is24h, timezone) {
  const now = new Date();
  let h, m, dayIdx, monthIdx, date, year;

  if (timezone) {
    try {
      const opts = { timeZone: timezone, hour12: false };
      const parts = new Intl.DateTimeFormat('en-US', {
        ...opts, hour: 'numeric', minute: '2-digit',
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
      }).formatToParts(now);
      const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
      h = parseInt(get('hour')) || 0;
      m = parseInt(get('minute')) || 0;
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      dayIdx = dayNames.findIndex(d => d.toLowerCase() === get('weekday').toLowerCase());
      if (dayIdx < 0) dayIdx = 0;
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      monthIdx = monthNames.findIndex(mn => mn.toLowerCase() === get('month').toLowerCase());
      if (monthIdx < 0) monthIdx = 0;
      date = parseInt(get('day')) || 1;
      year = parseInt(get('year')) || now.getFullYear();
    } catch {
      h = now.getHours(); m = now.getMinutes();
      dayIdx = now.getDay(); monthIdx = now.getMonth();
      date = now.getDate(); year = now.getFullYear();
    }
  } else {
    h = now.getHours(); m = now.getMinutes();
    dayIdx = now.getDay(); monthIdx = now.getMonth();
    date = now.getDate(); year = now.getFullYear();
  }

  const hStr = is24h ? String(h).padStart(2, '0') : String(((h + 11) % 12) + 1).padStart(2, ' ');
  const mStr = String(m).padStart(2, '0');
  const ampm = is24h ? '' : (h < 12 ? ' AM' : ' PM');
  const timeStr = hStr + ':' + mStr + ampm;

  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateStr = days[dayIdx] + '  ' + months[monthIdx] + ' ' + date;
  const yearStr = String(year);

  const center = (s) => {
    const pad = Math.max(0, Math.floor((cols - s.length) / 2));
    return ' '.repeat(pad) + s;
  };

  const lines = [];
  if (rows >= 6) {
    lines.push('');
    lines.push(center(timeStr));
    lines.push('');
    lines.push(center(dateStr));
    lines.push(center(yearStr));
    lines.push('');
  } else if (rows >= 3) {
    lines.push(center(timeStr));
    lines.push(center(dateStr));
    lines.push(center(yearStr));
  } else {
    lines.push(center(timeStr + '  ' + dateStr));
  }

  return lines;
}

export function formatWorldClockLines(rows, cols, cities, is24h) {
  const now = new Date();
  const count = Math.min(cities.length, rows);
  const lines = [];

  for (let i = 0; i < count; i++) {
    const c = cities[i];
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: c.tz || c.timezone,
      hour: 'numeric', minute: '2-digit',
      hour12: !is24h,
    });
    const timeStr = fmt.format(now).toUpperCase();
    const name = (c.city || c.name || '').split(',')[0].toUpperCase();
    const gap = Math.max(1, cols - name.length - timeStr.length);
    lines.push(name + ' '.repeat(gap) + timeStr);
  }

  return lines;
}

export function formatWeatherLines(rows, cols, data, cityName, unit) {
  const cur = data.current;
  const daily = data.daily;
  const temp = Math.round(cur.temperature_2m);
  const hi = Math.round(daily.temperature_2m_max[0]);
  const lo = Math.round(daily.temperature_2m_min[0]);
  const wind = Math.round(cur.wind_speed_10m);
  const humidity = Math.round(cur.relative_humidity_2m);
  const condition = WMO_CODES[cur.weather_code] || 'UNKNOWN';
  const unitLabel = unit === 'C' ? 'C' : 'F';
  const windLabel = unit === 'C' ? 'KMH' : 'MPH';

  const lines = [];
  if (rows >= 6) {
    lines.push(cityName.toUpperCase());
    lines.push(temp + '.' + unitLabel);
    lines.push(condition);
    lines.push('HI ' + hi + '   LO ' + lo);
    lines.push('WIND ' + wind + ' ' + windLabel);
    lines.push('HUMIDITY ' + humidity);
  } else if (rows >= 3) {
    lines.push(temp + '.' + unitLabel + '  ' + condition);
    lines.push('HI ' + hi + '  LO ' + lo);
    lines.push('WIND ' + wind + ' ' + windLabel + '  HUM ' + humidity);
  } else {
    lines.push(temp + '.' + unitLabel + ' ' + condition);
  }

  return lines;
}

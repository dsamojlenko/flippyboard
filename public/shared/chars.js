export const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,:!?'-/+@#&\uE000\uE001\uE002\uE003\uE004\uE005\uE006";
export const CHAR_SET = new Set(CHARS);

export const COLOR_TILES = {
  '\uE000': { name: 'Red',    upper: '#c0392b', lower: '#a93226', code: 'R' },
  '\uE001': { name: 'Orange', upper: '#d4782a', lower: '#ba6a25', code: 'O' },
  '\uE002': { name: 'Yellow', upper: '#d4a843', lower: '#b8923a', code: 'Y' },
  '\uE003': { name: 'Green',  upper: '#27ae60', lower: '#219a52', code: 'G' },
  '\uE004': { name: 'Blue',   upper: '#2980b9', lower: '#2471a3', code: 'B' },
  '\uE005': { name: 'Violet', upper: '#8e44ad', lower: '#7d3c98', code: 'V' },
  '\uE006': { name: 'White',  upper: '#d5d5d5', lower: '#c0c0c0', code: 'W' },
};

export const CODE_TO_COLOR = {};
for (const [ch, info] of Object.entries(COLOR_TILES)) {
  CODE_TO_COLOR[info.code] = ch;
}

export function sanitize(c) {
  if (typeof c === 'string' && c.length === 1 && COLOR_TILES[c]) return c;
  c = c.toUpperCase();
  return CHAR_SET.has(c) ? c : ' ';
}

export function parseColorCodes(text) {
  return text.replace(/\{([ROYGBVW])\}/gi, (_, code) => {
    return CODE_TO_COLOR[code.toUpperCase()] || '';
  });
}

export function expandJustify(text, width) {
  return text.split('\n').map(line => {
    const idx = line.indexOf('{>}');
    if (idx === -1) return line;
    const left = line.slice(0, idx);
    const right = line.slice(idx + 3);
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  }).join('\n');
}

export const WMO_CODES = {
  0: 'CLEAR SKY', 1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
  45: 'FOG', 48: 'RIME FOG',
  51: 'LIGHT DRIZZLE', 53: 'DRIZZLE', 55: 'HEAVY DRIZZLE',
  56: 'FREEZING DRIZZLE', 57: 'FREEZING DRIZZLE',
  61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN',
  66: 'FREEZING RAIN', 67: 'FREEZING RAIN',
  71: 'LIGHT SNOW', 73: 'SNOW', 75: 'HEAVY SNOW',
  77: 'SNOW GRAINS',
  80: 'LIGHT SHOWERS', 81: 'SHOWERS', 82: 'HEAVY SHOWERS',
  85: 'SNOW SHOWERS', 86: 'HEAVY SNOW SHOWERS',
  95: 'THUNDERSTORM', 96: 'THUNDERSTORM/HAIL', 99: 'THUNDERSTORM/HAIL',
};

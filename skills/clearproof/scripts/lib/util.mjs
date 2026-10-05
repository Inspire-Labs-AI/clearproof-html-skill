// Small helpers shared by every module.

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const isWide = (ch) => /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch);

// Approximate rendered width of text in a proportional sans font.
// Good enough for layout; the visual check catches the cases where it is not.
const NARROW = /[ilj.,:;'|!()[\]{}]/;
const WIDE = /[mwMW@%]/;
export function textWidth(text, size = 13) {
  let w = 0;
  for (const ch of String(text)) {
    if (isWide(ch)) w += 1.0;
    else if (NARROW.test(ch)) w += 0.3;
    else if (WIDE.test(ch)) w += 0.85;
    else if (/[A-Z0-9]/.test(ch)) w += 0.64;
    else w += 0.55;
  }
  return w * size;
}

// Wrap text into lines that fit maxWidth.
export function wrap(text, maxWidth, size = 13) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textWidth(next, size) > maxWidth) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Parse `{span=2 #id say="hello there" bare}` style attribute strings.
export function parseAttrs(src) {
  const out = {};
  const re = /([#.]?[\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const [, key, dq, sq, bare] = m;
    if (key.startsWith('#')) out.id = key.slice(1);
    else out[key] = dq ?? sq ?? bare ?? true;
  }
  return out;
}

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/^(?=\d)/, 's-') || 'section'; // ids must not start with a digit (CSS selectors)

// An error the agent can act on: where, what, and a correct example.
export class DraftError extends Error {
  constructor(message, { line = 0, component = '', example = '' } = {}) {
    super(message);
    this.name = 'DraftError';
    this.line = line;
    this.component = component;
    this.example = example;
  }
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

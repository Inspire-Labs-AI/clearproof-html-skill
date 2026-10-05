// Readability checks on the prose the model wrote (ASD-STE100 inspired) plus page-structure checks.
// Warnings only, unless style: strict.

const WORDY = {
  utilize: 'use', utilise: 'use', leverage: 'use', facilitate: 'help', commence: 'start', terminate: 'stop',
  'prior to': 'before', 'subsequent to': 'after', 'in order to': 'to', 'due to the fact that': 'because',
  'at this point in time': 'now', 'in the event that': 'if', 'a number of': 'some', 'is able to': 'can',
  'make use of': 'use', 'with regard to': 'about', 'in addition': 'also', approximately: 'about',
  'ensure that': 'make sure', endeavor: 'try', ascertain: 'find out', 'in close proximity': 'near',
  robust: 'say what makes it strong', seamless: 'say what is easy', 'cutting-edge': 'new',
  delve: 'look at', 'it is important to note that': '(delete)', 'it should be noted that': '(delete)',
  basically: '(delete)', essentially: '(delete)', 'very ': '(delete or use a stronger word)',
};
const WORDY_RE = Object.entries(WORDY).map(([w, s]) => ({ re: new RegExp(`\\b${w.trim().replace(/ /g, '\\s+')}\\b`, 'i'), w: w.trim(), s }));
const PASSIVE = /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|known|done|made|given|taken|seen|written|built|shown|sent|kept|held|found|run|chosen|driven|broken|thrown|hidden|read|told|left|lost|paid|caught|bought|sold|spent|split|cut|hit|led|fed|bound|ground)\b/i;

export function sentences(text) {
  const masked = text.replace(/\b(e\.g|i\.e|etc|vs|cf|approx|Fig|No)\./gi, (m) => m.replace(/\./g, '\u0000'));
  return (masked.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? []).map((s) => s.replace(/\u0000/g, '.').trim()).filter(Boolean);
}
const words = (s) => s.match(/[A-Za-z0-9][\w'’-]*/g)?.length ?? 0;
const clean = (t) =>
  t.replace(/`[^`]*`/g, 'X').replace(/\[\[[^\]]*\]\]/g, 'X').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/~~[^~]*~~/g, '').replace(/[*_]/g, '');

export function lintProse(text, startLine, out) {
  let para = { n: 0, line: startLine };
  const end = () => {
    if (para.n > 5) out.push({ line: para.line, rule: 'paragraph', message: `paragraph has ${para.n} sentences (max 5); split it or use a list` });
    para = { n: 0, line: 0 };
  };
  text.split('\n').forEach((raw, i) => {
    const line = startLine + i;
    const t = raw.trim();
    if (!t || /^(#|>|\|.*-{3})/.test(t)) return end();
    const isTable = t.startsWith('|');
    const item = t.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (isTable || item) end();
    const body = clean(isTable ? t.replace(/\|/g, '. ') : item ? item[1] : t);
    const step = item && /^\d/.test(t);
    for (const s of sentences(body)) {
      const n = words(s);
      const max = step ? 20 : 25;
      if (n > max) out.push({ line, rule: 'length', message: `${n}-word sentence (max ${max}${step ? ' for a step' : ''}): "${s.slice(0, 60)}…"`, suggestion: 'one idea per sentence' });
      const quote = `in "${s.length > 70 ? `${s.slice(0, 67)}…` : s}"`;
      for (const { re, w, s: sug } of WORDY_RE) if (re.test(s)) out.push({ line, rule: 'word', message: `"${w}" ${quote}`, suggestion: sug });
      const p = s.match(PASSIVE);
      if (p) out.push({ line, rule: 'passive', message: `passive voice "${p[0]}" ${quote}`, suggestion: 'say who does it' });
      if (!isTable && !item) para.n++;
    }
    if (!para.line) para.line = line;
  });
  end();
}

export function lintDraft(doc, { coverage } = {}) {
  const out = [];
  const { meta, intro, panels } = doc;
  if (!meta.title) out.push({ line: 1, rule: 'structure', message: 'no title in front matter' });
  if (!meta.tldr) out.push({ line: 1, rule: 'structure', message: 'no tldr: give the answer in one line first', suggestion: 'tldr: Use Redis; you need persistence' });
  else if (words(meta.tldr) > 30) out.push({ line: 1, rule: 'structure', message: `tldr is ${words(meta.tldr)} words; keep it under 30` });
  if (panels.length > 10) out.push({ line: panels[10].line, rule: 'structure', message: `${panels.length} sections; more than 10 is hard to take in. Merge or cut` });
  for (const b of [...intro, ...panels.flatMap((p) => p.blocks)]) {
    if (b.type === 'md') lintProse(b.text, b.line, out);
    else if (b.lang === 'callout') lintProse(b.text, b.line + 1, out);
    else if (['diff', 'code'].includes(b.lang)) {
      // Notes are prose too: "+42: text" -> "text", one note per line.
      lintProse(b.text.split('\n').map((l) => (l.trim() ? `- ${l.replace(/^\s*[+-]?\d+(-\d+)?\s*:\s*/, '')}` : '')).join('\n'), b.line + 1, out);
    } else if (['flow', 'sequence'].includes(b.lang)) {
      // Step captions are what the tour reads aloud.
      lintProse(b.text.split('\n').map((l) => (l.includes(' | ') ? `- ${l.slice(l.lastIndexOf(' | ') + 3)}` : '')).join('\n'), b.line + 1, out);
    }
  }
  for (const p of panels) {
    const prose = p.blocks.filter((b) => b.type === 'md').map((b) => b.text).join(' ');
    const visual = p.blocks.some((b) => b.type === 'fence');
    const n = words(clean(prose));
    if (!visual && n > 160 && !/\|/.test(prose)) out.push({ line: p.line, rule: 'wall', message: `"${p.title}" is ${n} words of prose and no visual; add a diagram, table or list, or cut` });
  }
  if (meta.kind !== 'review' && panels.length >= 3) {
    const skip = /^(the short version|short version|glossary|words used here|check yourself|sources|quiz|summary)$/i;
    const titled = panels.filter((p) => !skip.test(p.title.trim()) && !p.attrs.hero);
    const labels = titled.filter((p) => p.title.trim().split(/\s+/).length <= 3 && !/\d/.test(p.title));
    if (labels.length * 2 > titled.length) out.push({ line: labels[0].line, rule: 'headline', message: `${labels.length} of ${titled.length} section titles are topic labels (e.g. "${labels[0].title}")`, suggestion: 'state the takeaway: "Memory costs 75× an L1 hit", not "Memory"' });
    const pictures = panels.filter((p) => p.blocks.some((b) => b.type === 'fence' && !['callout', 'quiz', 'glossary', 'checklist', 'claims', 'kv'].includes(b.lang)));
    if (pictures.length * 2 < titled.length) out.push({ line: panels[0].line, rule: 'figures', message: `only ${pictures.length} of ${panels.length} sections have a figure`, suggestion: 'let figures carry the page: a diagram, chart, waffle, cases or figure per section' });
  }
  for (const b of panels.flatMap((p) => p.blocks).filter((x) => x.type === 'fence')) {
    const cap = (b.args.match(/caption="([^"]*)"/) ?? [])[1];
    if (cap !== undefined && (/^(diagram|figure|overview|chart|illustration|graph)\b/i.test(cap.trim()) || cap.trim().split(/\s+/).length < 4)) {
      out.push({ line: b.line, rule: 'caption', message: `caption "${cap}" names the figure instead of saying what to notice`, suggestion: 'state the claim: "Row order misses once per line; column order misses every read."' });
    }
  }
  for (const b of [...intro, ...panels.flatMap((p) => p.blocks)].filter((x) => x.type === 'md')) {
    const m = b.text.match(/\b\d+(?:\.\d+)?x\b/);
    if (m) out.push({ line: b.line, rule: 'typography', message: `"${m[0]}"`, suggestion: `use × ("${m[0].replace(/x$/, '×')}")` });
  }
  // A headline that counts things ("Six problems") must match what the page lists.
  const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const p of panels) {
    const m = p.title.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(problems|risks|issues|bugs|findings|ways|cases|failure modes)\b/i);
    if (!m) continue;
    const n = Number(m[1]) || WORDS[m[1].toLowerCase()];
    const block = p.blocks.find((b) => b.type === 'fence' && ['risks', 'cases'].includes(b.lang));
    if (!block) continue;
    const count = block.lang === 'risks' ? block.text.split('\n').filter((l) => l.trim() && !/^\s/.test(l)).length : block.text.split('\n').filter((l) => /^\s*#/.test(l)).length;
    if (count !== n) out.push({ line: p.line, rule: 'consistency', message: `"${p.title}" says ${n} but the ${block.lang} block lists ${count}`, suggestion: 'make the count in the headline match' });
  }
  if (meta.kind === 'review') {
    for (const b of panels.flatMap((p) => p.blocks)) {
      if (b.type === 'fence' && ['quiz', 'glossary'].includes(b.lang)) out.push({ line: b.line, rule: 'review', message: `a ${b.lang} in a review is padding for a busy reviewer`, suggestion: 'drop it' });
    }
  }
  if (coverage) {
    for (const h of coverage.missing) {
      out.push({ line: 0, rule: 'coverage', message: `${h.id} ${h.file} (+${h.add} −${h.del}) is never shown or referenced`, suggestion: `show it in a \`\`\`diff ${h.id} block or mention [[${h.id}]] in the text` });
    }
  }
  return out;
}

export const formatWarning = (w) => `L${w.line} [${w.rule}] ${w.message}${w.suggestion ? ` → ${w.suggestion}` : ''}`;

// Every number with a unit, grouped by unit, so the author can spot "90 ns" here and "100 ns" there.
const UNITS = 'ns|µs|us|ms|s|KB|KiB|MB|MiB|GB|GiB|TB|bytes|B|cycles|×|%|req/s|rows|pages';
export function numberInventory(source) {
  const text = String(source).replace(/```(?:run|code|diff)[\s\S]*?```/g, '');
  const re = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s?(${UNITS})(?![A-Za-z])`, 'g');
  const by = new Map();
  for (const m of text.matchAll(re)) {
    const unit = m[2];
    const v = m[1].replace(/,/g, '');
    if (!by.has(unit)) by.set(unit, new Map());
    by.get(unit).set(v, (by.get(unit).get(v) ?? 0) + 1);
  }
  return [...by].filter(([, vals]) => vals.size > 1).map(([unit, vals]) => `${unit}: ${[...vals].sort((a, b) => a - b).map(([v, n]) => (n > 1 ? `${v} ×${n}` : v)).join(', ')}`);
}

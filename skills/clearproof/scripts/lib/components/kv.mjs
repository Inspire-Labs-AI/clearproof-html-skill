import { inline } from '../md.mjs';

export default {
  name: 'kv',
  summary: 'Key facts: metadata, specs, a summary card.',
  syntax: '```kv\nOwner: payments team\nLatency budget: 200 ms\n```',
  example: '```kv\nVersion: 2.4\nLicense: MIT\n```',
  render(text, ctx) {
    const rows = text.split('\n').filter((l) => l.includes(':')).map((l) => {
      const k = l.indexOf(':');
      return [l.slice(0, k).trim(), l.slice(k + 1).trim()];
    });
    return `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${inline(k, ctx)}</dt><dd>${inline(v, ctx)}</dd></div>`).join('')}</dl>`;
  },
};

// Code references. A draft points at code ("src/auth.js:40-52"); clearproof reads the real lines.
// A reference to a missing file or line is an error, so a page can never cite code that is not there.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { esc, DraftError } from './util.mjs';

export function parseRef(ref) {
  const m = String(ref).trim().match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
  return { path: m[1], start: m[2] ? +m[2] : null, end: m[3] ? +m[3] : m[2] ? +m[2] : null };
}

export function createRepo(root, { link } = {}) {
  const files = new Map();
  const read = (path, line = 0) => {
    const abs = isAbsolute(path) ? path : resolve(root, path);
    if (!files.has(abs)) {
      if (!existsSync(abs) || !statSync(abs).isFile()) throw new DraftError(`Code reference points at a file that does not exist: ${path}`, { line, component: 'ref', example: '[[src/server.js:42]]  or  ```code src/server.js:40-60' });
      files.set(abs, readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n'));
    }
    return { abs, rel: relative(root, abs) || path, lines: files.get(abs) };
  };
  const template = link || process.env.CLEARPROOF_LINK || 'vscode://file/{abs}:{line}';
  const href = (abs, rel, line) => template.replace('{abs}', abs).replace('{path}', rel).replace('{line}', String(line ?? 1));

  return {
    root,
    read,
    href,
    // Resolve and verify a reference; returns the lines it covers.
    resolve(ref, line = 0) {
      const r = parseRef(ref);
      const f = read(r.path, line);
      if (r.start !== null) {
        if (r.start < 1 || r.end > f.lines.length || r.end < r.start) {
          throw new DraftError(`${r.path} has ${f.lines.length} lines; reference ${r.start}${r.end !== r.start ? `-${r.end}` : ''} is out of range`, { line, component: 'ref' });
        }
      }
      return { ...r, ...f };
    },
    // Inline [[path:line]] chip with a hover preview of the real code.
    chip(ref, line = 0) {
      const r = this.resolve(ref, line);
      const s = r.start ?? 1;
      const e = r.end ?? Math.min(r.lines.length, s + 5);
      const from = Math.max(1, s - 2);
      const to = Math.min(r.lines.length, e + 2, from + 14);
      const snip = r.lines
        .slice(from - 1, to)
        .map((t, k) => `${from + k}${from + k >= s && from + k <= e ? '▌' : ' '} ${t}`)
        .join('\n');
      const label = `${r.rel}${r.start ? `:${r.start}${r.end !== r.start ? `-${r.end}` : ''}` : ''}`;
      return `<a class="ref" href="${esc(href(r.abs, r.rel, r.start))}" data-snip="${esc(snip)}">${esc(label)}</a>`;
    },
  };
}

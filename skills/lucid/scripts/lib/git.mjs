// Read the change under review straight from git. Hunks get stable ids (H1, H2, ...) that drafts refer to,
// so the model never retypes code and every changed line can be accounted for.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DraftError } from './util.mjs';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const tryGit = (cwd, args) => {
  try {
    return git(cwd, args).trim();
  } catch {
    return null;
  }
};

export function repoRoot(cwd) {
  return tryGit(cwd, ['rev-parse', '--show-toplevel']);
}

// Default base: where this branch left the default branch; else the last commit.
// The working tree is always compared, so uncommitted and untracked work is included.
export function resolveBase(cwd, base) {
  if (base) {
    const sha = tryGit(cwd, ['rev-parse', '--verify', `${base}^{commit}`]);
    if (!sha) throw new DraftError(`git cannot find base "${base}"`, { component: 'diff' });
    return { sha, label: base };
  }
  for (const ref of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
    if (!tryGit(cwd, ['rev-parse', '--verify', '--quiet', ref])) continue;
    const mb = tryGit(cwd, ['merge-base', 'HEAD', ref]);
    if (mb) return { sha: mb, label: `merge-base with ${ref}` };
  }
  const head = tryGit(cwd, ['rev-parse', '--verify', 'HEAD']);
  if (!head) return { sha: null, label: 'empty repository' };
  return { sha: head, label: 'HEAD' };
}

export function parseUnified(text) {
  const files = [];
  let file = null;
  let hunk = null;
  let oldN = 0;
  let newN = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      file = { path: m ? m[2] : line.slice(11), oldPath: m ? m[1] : null, status: 'M', add: 0, del: 0, hunks: [], binary: false };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    if (line.startsWith('new file mode')) file.status = 'A';
    else if (line.startsWith('deleted file mode')) file.status = 'D';
    else if (line.startsWith('rename from')) file.status = 'R';
    else if (line.startsWith('Binary files')) file.binary = true;
    else if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/);
      hunk = { oldStart: +m[1], oldLen: m[2] === undefined ? 1 : +m[2], newStart: +m[3], newLen: m[4] === undefined ? 1 : +m[4], header: m[5] || '', lines: [], add: 0, del: 0 };
      oldN = hunk.oldStart;
      newN = hunk.newStart;
      file.hunks.push(hunk);
    } else if (hunk && !line.startsWith('---') && !line.startsWith('+++')) {
      const t = line[0];
      const body = line.slice(1);
      if (t === '+') {
        hunk.lines.push({ t, text: body, new: newN++ });
        hunk.add++;
        file.add++;
      } else if (t === '-') {
        hunk.lines.push({ t, text: body, old: oldN++ });
        hunk.del++;
        file.del++;
      } else if (t === ' ') hunk.lines.push({ t, text: body, old: oldN++, new: newN++ });
    }
  }
  return files;
}

function untracked(cwd) {
  const out = tryGit(cwd, ['ls-files', '--others', '--exclude-standard']);
  if (!out) return [];
  return out.split('\n').filter(Boolean).flatMap((path) => {
    try {
      const abs = join(cwd, path);
      if (statSync(abs).size > 512 * 1024) return [];
      const text = readFileSync(abs, 'utf8');
      if (text.includes('\u0000')) return [];
      const lines = text.replace(/\n$/, '').split('\n');
      const hunk = { oldStart: 0, oldLen: 0, newStart: 1, newLen: lines.length, header: 'new, untracked', lines: lines.map((l, i) => ({ t: '+', text: l, new: i + 1 })), add: lines.length, del: 0 };
      return [{ path, oldPath: null, status: 'A', add: lines.length, del: 0, hunks: [hunk], binary: false, untracked: true }];
    } catch {
      return [];
    }
  });
}

const cache = new Map();
export function loadDiff(cwd, base) {
  const root = repoRoot(cwd);
  if (!root) throw new DraftError('Not inside a git repository, so there is no diff to review', { component: 'diff' });
  const key = `${root}\u0000${base ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const b = resolveBase(root, base);
  const text = b.sha ? git(root, ['diff', '--no-color', '--no-ext-diff', '--find-renames', '-U3', b.sha]) : '';
  const files = [...parseUnified(text), ...untracked(root)].sort((x, y) => x.path.localeCompare(y.path));
  let n = 0;
  for (const f of files) for (const h of f.hunks) {
    h.id = `H${++n}`;
    h.file = f.path;
  }
  const head = tryGit(root, ['rev-parse', '--verify', 'HEAD']);
  const dirty = Boolean(tryGit(root, ['status', '--porcelain']));
  const diff = {
    root,
    base: b,
    head,
    dirty,
    files,
    hunks: files.flatMap((f) => f.hunks),
    add: files.reduce((s, f) => s + f.add, 0),
    del: files.reduce((s, f) => s + f.del, 0),
  };
  cache.set(key, diff);
  return diff;
}

// The index the agent reads before writing a review draft.
export function formatDiffIndex(diff, { full = true, maxLines = 80 } = {}) {
  const out = [];
  out.push(`base: ${diff.base.sha ? diff.base.sha.slice(0, 12) : '(none)'} (${diff.base.label})`);
  out.push(`${diff.files.length} files · +${diff.add} −${diff.del} · ${diff.hunks.length} hunks`);
  out.push('');
  for (const f of diff.files) {
    out.push(`${f.status} ${f.path}${f.oldPath && f.oldPath !== f.path ? ` (from ${f.oldPath})` : ''}${f.untracked ? ' [untracked]' : ''}  +${f.add} −${f.del}${f.binary ? '  [binary]' : ''}`);
    for (const h of f.hunks) {
      out.push(`  ${h.id}  +${h.add} −${h.del}  new L${h.newStart}-${h.newStart + Math.max(0, h.newLen - 1)}${h.header ? `  ${h.header.trim()}` : ''}`);
      if (!full) continue;
      const shown = h.lines.slice(0, maxLines);
      for (const l of shown) out.push(`    ${l.t === '+' ? `+${String(l.new).padStart(4)}` : l.t === '-' ? `-${String(l.old).padStart(4)}` : `${String(l.new).padStart(5)}`} ${l.text}`);
      if (h.lines.length > maxLines) out.push(`    … ${h.lines.length - maxLines} more lines`);
    }
  }
  return out.join('\n');
}

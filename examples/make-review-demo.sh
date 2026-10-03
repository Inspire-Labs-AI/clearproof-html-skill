#!/usr/bin/env bash
# Builds the small repository that examples/review-token-refresh.md reviews:
# a committed base, a feature branch with one commit, plus uncommitted and untracked work.
# Usage: examples/make-review-demo.sh /tmp/lucid-demo && cd /tmp/lucid-demo &&
#        node <repo>/skills/lucid/scripts/lucid.mjs render <repo>/examples/review-token-refresh.md --check
set -euo pipefail
D=${1:?target directory}
rm -rf "$D" && mkdir -p "$D/src/auth" && cd "$D"
git init -q -b main && git config user.email demo@example.com && git config user.name demo

cat > src/server.js <<'EOF'
import http from 'node:http';
import { getSession } from './auth/session.js';
import { store } from './store.js';

const routes = {
  'GET /me': async (req) => {
    const session = await getSession(req.headers.authorization);
    if (!session) return [401, { error: 'login required' }];
    return [200, await store.getUser(session.userId)];
  },
};

http.createServer(async (req, res) => {
  const handler = routes[`${req.method} ${req.url}`];
  const [status, body] = handler ? await handler(req) : [404, { error: 'not found' }];
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}).listen(process.env.PORT || 3000);
EOF
cat > src/auth/session.js <<'EOF'
import { store } from '../store.js';

export async function getSession(header) {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const session = await store.getSession(token);
  return session ?? null;
}
EOF
cat > src/store.js <<'EOF'
const sessions = new Map();
const users = new Map([['u1', { id: 'u1', name: 'Ada' }]]);

export const store = {
  async getSession(token) {
    return sessions.get(token);
  },
  async putSession(token, session) {
    sessions.set(token, session);
  },
  async getUser(id) {
    return users.get(id);
  },
};
EOF
git add -A && git commit -qm "Basic session auth" && git checkout -qb feature/token-refresh

cat > src/auth/session.js <<'EOF'
import { store } from '../store.js';
import { refreshSession } from './refresh.js';

const GRACE_MS = 30_000;

export async function getSession(header) {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  let session = await store.getSession(token);
  if (!session) return null;
  if (session.expiresAt < Date.now() - GRACE_MS) {
    await store.deleteSession(token);
    return null;
  }
  if (session.expiresAt < Date.now()) {
    session = await refreshSession(token, session);
  }
  return session;
}
EOF
cat > src/store.js <<'EOF'
const sessions = new Map();
const users = new Map([['u1', { id: 'u1', name: 'Ada' }]]);

export const store = {
  async getSession(token) {
    return sessions.get(token);
  },
  async putSession(token, session) {
    sessions.set(token, session);
  },
  async deleteSession(token) {
    sessions.delete(token);
  },
  async getUser(id) {
    return users.get(id);
  },
};
EOF
git add -A && git commit -qm "Refresh sessions inside a grace window"

# Uncommitted: a logout route. Untracked: the refresh module.
cat > src/auth/refresh.js <<'EOF'
import { randomUUID } from 'node:crypto';
import { store } from '../store.js';

const TTL_MS = 15 * 60_000;

// Swap an expired-but-recent session for a new one.
export async function refreshSession(oldToken, session) {
  const next = { ...session, expiresAt: Date.now() + TTL_MS, rotatedFrom: oldToken };
  let attempts = 0;
  while (true) {
    try {
      await store.putSession(randomUUID(), next);
      break;
    } catch (err) {
      attempts++;
      await new Promise((r) => setTimeout(r, 100 * attempts));
    }
  }
  return next;
}
EOF
python3 - <<'EOF'
p = 'src/server.js'
s = open(p).read()
s = s.replace("""    return [200, await store.getUser(session.userId)];
  },""", """    return [200, await store.getUser(session.userId)];
  },
  'POST /logout': async (req) => {
    const session = await getSession(req.headers.authorization);
    if (!session) return [401, { error: 'login required' }];
    await store.deleteSession(req.headers.authorization.slice(7));
    return [204, null];
  },""")
open(p, 'w').write(s)
EOF
echo "demo repository ready: $D"

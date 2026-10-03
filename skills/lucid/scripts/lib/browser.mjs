// Find Playwright (local or global install). It is optional: render works without it.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch { /* try the global install */ }
  try {
    const globalRoot = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const req = createRequire(join(globalRoot, 'noop.js'));
    return req('playwright');
  } catch {
    return null;
  }
}

export async function launch() {
  const pw = await loadPlaywright();
  if (!pw) return null;
  try {
    return await pw.chromium.launch();
  } catch (e) {
    for (const path of ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome']) {
      try {
        return await pw.chromium.launch({ executablePath: path });
      } catch { /* next */ }
    }
    throw e;
  }
}

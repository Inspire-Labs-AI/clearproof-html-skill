// Find Playwright (local or global install). It is optional: render works without it.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch { /* try the global install */ }
  try {
    // The global node_modules folder next to this Node.js install (no subprocess, nothing downloaded).
    const bin = dirname(process.execPath);
    const globalRoot = process.platform === 'win32' ? join(bin, 'node_modules') : join(bin, '..', 'lib', 'node_modules');
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

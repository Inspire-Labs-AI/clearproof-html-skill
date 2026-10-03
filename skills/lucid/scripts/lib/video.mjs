// Explainer video: record the page's narrated tour and encode an MP4.
// The tour is the script: the hero line, each section's narration, then each diagram step.
// Voices: elevenlabs (ELEVENLABS_API_KEY), say (macOS), espeak (Linux), none (captions only).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const has = (cmd) => {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
export const estimate = (t) => Math.max(2.2, t.split(/\s+/).length / 2.7 + 0.8);

const VOICES = {
  async elevenlabs(text, out) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error('Set ELEVENLABS_API_KEY to use the elevenlabs voice');
    const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' }),
    });
    if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    writeFileSync(`${out}.mp3`, Buffer.from(await res.arrayBuffer()));
    return `${out}.mp3`;
  },
  async say(text, out) {
    execFileSync('say', ['-o', `${out}.aiff`, text]);
    return `${out}.aiff`;
  },
  async espeak(text, out) {
    execFileSync(has('espeak-ng') ? 'espeak-ng' : 'espeak', ['-w', `${out}.wav`, text]);
    return `${out}.wav`;
  },
  // Test voice: a quiet tone as long as the text would take to read.
  async tone(text, out) {
    ff(['-f', 'lavfi', '-i', `sine=frequency=330:duration=${estimate(text).toFixed(2)}`, '-af', 'volume=0.05', `${out}.wav`]);
    return `${out}.wav`;
  },
};

export function pickVoice(name) {
  if (name && name !== 'auto') return name;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.platform === 'darwin' && has('say')) return 'say';
  if (has('espeak-ng') || has('espeak')) return 'espeak';
  return 'none';
}

export async function makeVideo(htmlPath, { out, voice = 'auto', width = 1280, height = 720, log = () => {} } = {}) {
  if (!has('ffmpeg')) throw new Error('ffmpeg is needed for video export');
  const browser = await launch();
  if (!browser) throw new Error('Playwright is needed for video export (npm i -g playwright)');
  const work = mkdtempSync(join(tmpdir(), 'lucid-video-'));
  const url = pathToFileURL(htmlPath).href;
  try {
    // 1. Read the narration script from the page itself.
    const probe = await browser.newPage({ viewport: { width, height } });
    await probe.goto(url);
    const texts = await probe.evaluate(() => window.lucidSegments());
    await probe.close();
    if (!texts.length) throw new Error('The page has nothing to narrate');

    // 2. Voice each segment; its audio length sets how long the page stays on it.
    const v = pickVoice(voice);
    if (v !== 'none' && !VOICES[v]) throw new Error(`Unknown voice "${v}". Use: auto, elevenlabs, say, espeak, none`);
    log(`narration: ${texts.length} segments, voice: ${v}`);
    const GAP = 0.45;
    const clips = [];
    const timings = [];
    for (const [k, text] of texts.entries()) {
      if (v === 'none') {
        timings.push(estimate(text));
        continue;
      }
      const file = await VOICES[v](text || '.', join(work, `seg${String(k).padStart(3, '0')}`));
      const d = duration(file);
      clips.push({ file, d });
      timings.push(d + GAP);
    }

    // 3. Record the tour, paced by those timings.
    const ctx = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: work, size: { width, height } } });
    await ctx.addInitScript((t) => (window.LUCID_TIMINGS = t), timings);
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`${url}?video&mute`);
    await page.waitForFunction(() => document.readyState === 'complete');
    const lead = (Date.now() - t0) / 1000;
    await page.evaluate(() => window.lucidStartTour());
    const total = timings.reduce((a, b) => a + b, 0);
    await page.waitForFunction(() => window.lucidTourDone === true, null, { timeout: (total + 30) * 1000, polling: 200 });
    await page.waitForTimeout(400);
    await ctx.close();
    const webm = readdirSync(work).find((f) => f.endsWith('.webm'));
    if (!webm) throw new Error('Recording failed: no video file was written');

    // 4. Encode. Trim the page-load lead-in; lay the voice clips at their segment start times.
    const args = ['-ss', lead.toFixed(2), '-i', join(work, webm)];
    if (clips.length) {
      let at = 0;
      const parts = [];
      clips.forEach((c, k) => {
        args.push('-i', c.file);
        parts.push(`[${k + 1}:a]adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[a${k}]`);
        at += timings[k];
      });
      const mix = `${parts.join(';')};${clips.map((_, k) => `[a${k}]`).join('')}amix=inputs=${clips.length}:normalize=0[aout]`;
      args.push('-filter_complex', mix, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k');
    }
    args.push('-t', (total + 0.5).toFixed(2), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', out);
    ff(args);
    if (!existsSync(out)) throw new Error('ffmpeg did not write the video');
    return { out, seconds: total, segments: texts.length, voice: v };
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

import { readFileSync } from 'node:fs';
// Look at the rendered page the way a reader would, and report what is broken.
// Problems come back in the same "where / what" shape as draft errors so the agent can fix them.

import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

// Runs inside the page.
function inspect() {
  const out = [];
  const name = (el) => {
    const sec = el.closest('section');
    return sec ? `section "${sec.querySelector('h2')?.textContent.replace(/^\S+\s/, '').trim() || 'hero'}"` : 'page header';
  };
  const doc = document.documentElement;
  if (doc.scrollWidth > innerWidth + 2) out.push({ level: 'error', where: 'page', message: `page scrolls sideways (${doc.scrollWidth}px wide in a ${innerWidth}px window)` });
  for (const sec of document.querySelectorAll('main > section')) {
    const box = sec.getBoundingClientRect();
    if (!sec.textContent.trim() && !sec.querySelector('svg')) out.push({ level: 'error', where: name(sec), message: 'section is empty' });
    for (const el of sec.querySelectorAll('svg, table, img, pre, figure, .callout, .tree')) {
      if (el.closest('.scroll, .tbl, pre')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > box.right + 2) out.push({ level: 'error', where: name(el), message: `${el.tagName.toLowerCase()} sticks out of its section by ${Math.round(r.right - box.right)}px` });
    }
    for (const t of sec.querySelectorAll('.tbl')) {
      if (t.scrollWidth > t.clientWidth + 4) out.push({ level: innerWidth < 600 ? 'warn' : 'error', where: name(t), message: `table is cut off (needs ${t.scrollWidth}px, has ${t.clientWidth}px); give the section span=full or shorten the cells` });
    }
    if (innerWidth > 600) {
      let small = null;
      for (const t of sec.querySelectorAll('svg text, .custom-fig *')) {
        if (!t.textContent.trim() || t.children.length && t.tagName !== 'text') continue;
        const h = t.tagName === 'text' || t.tagName === 'tspan' ? t.getBoundingClientRect().height : parseFloat(getComputedStyle(t).fontSize);
        if (h > 0 && h < 10.5 && (!small || h < small.h)) small = { h, text: t.textContent.trim().slice(0, 24) };
      }
      if (small) out.push({ level: 'warn', where: name(sec), message: `figure text renders at about ${Math.round(small.h)}px ("${small.text}"); make the figure wider or the labels shorter so text is at least 11px` });
    }
    for (const svg of sec.querySelectorAll('svg')) {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.width < 260 && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 520) {
        out.push({ level: 'warn', where: name(svg), message: `diagram is squeezed to ${Math.round(r.width)}px; give the section span=2 or use LR/TB the other way` });
      }
      const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => ({ t, r: t.getBoundingClientRect() }));
      if (getComputedStyle(svg).overflow !== 'visible') {
        const clipped = texts.find(({ r: tr }) => tr.width > 0 && (tr.right > r.right + 1 || tr.left < r.left - 1 || tr.bottom > r.bottom + 1 || tr.top < r.top - 1));
        if (clipped) out.push({ level: 'warn', where: name(svg), message: `label "${clipped.t.textContent.trim().slice(0, 30)}" is cut off at the edge of its figure; widen the viewBox or move the label` });
      }
      const shapes = [...svg.querySelectorAll('.node, g.cn:not(.faded)')].map((g) => ({ g, r: g.querySelector('rect,polygon,path').getBoundingClientRect() }));
      const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);
      const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      let reported = 0;
      for (let i = 0; i < texts.length && reported < 4; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i];
          const b = texts[j];
          if (a.t.parentNode === b.t.parentNode && a.t.closest('.node')) continue;
          const o = inter(a.r, b.r);
          if (o > 0.25 * Math.min(area(a.r), area(b.r)) && o > 12) {
            out.push({ level: 'warn', where: name(svg), message: `labels overlap: "${a.t.textContent.slice(0, 30)}" and "${b.t.textContent.slice(0, 30)}"` });
            reported++;
            break;
          }
        }
      }
      const grps = [...svg.querySelectorAll('.grp rect')].map((g) => ({ g, r: g.getBoundingClientRect() }));
      for (let i = 0; i < grps.length; i++)
        for (let j = i + 1; j < grps.length; j++)
          if (inter(grps[i].r, grps[j].r) > 0 && !(grps[i].r.left <= grps[j].r.left && grps[i].r.right >= grps[j].r.right && grps[i].r.top <= grps[j].r.top && grps[i].r.bottom >= grps[j].r.bottom))
            out.push({ level: 'warn', where: name(svg), message: `group boxes overlap: "${grps[i].g.nextSibling?.textContent}" and "${grps[j].g.nextSibling?.textContent}"; drop a group or split the diagram` });
      for (const lab of svg.querySelectorAll('.elabel, .cl')) {
        const lr = lab.getBoundingClientRect();
        for (const s of shapes) {
          if (inter(lr, s.r) > 0.3 * area(lr)) {
            out.push({ level: 'warn', where: name(svg), message: `arrow label "${lab.textContent.slice(0, 30)}" sits on node "${s.g.textContent.slice(0, 30)}"` });
            break;
          }
        }
      }
    }
  }
  return out;
}

export async function checkPage(htmlPath, { shot, section } = {}) {
  const browser = await launch();
  if (!browser) return { skipped: 'Playwright is not installed, so the visual check was skipped (npm i -g playwright).' };
  const problems = [];
  let closeups = [];
  let sheetFile = null;
  try {
    for (const [label, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (e) => problems.push({ level: 'error', where: `${label} runtime`, message: e.message }));
      page.on('console', (m) => m.type() === 'error' && problems.push({ level: 'error', where: `${label} console`, message: m.text() }));
      await page.goto(pathToFileURL(htmlPath).href);
      await page.waitForTimeout(150);
      const found = await page.evaluate(inspect);
      for (const p of found) problems.push({ ...p, where: `${label} · ${p.where}` });
      if (shot) await page.screenshot({ path: label === 'desktop' ? shot : shot.replace(/\.png$/, '-phone.png'), fullPage: true });
      await page.close();
    }
    if (shot && !section) {
      // A sharp close-up of every figure: critique figures at the size a reader sees them, not in a shrunken page.
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
      await page.goto(pathToFileURL(htmlPath).href);
      // The sticky top bar would otherwise cover the top of tall figures in their close-ups.
      await page.addStyleTag({ content: '.topbar{position:static!important}' });
      await page.waitForTimeout(200);
      const figs = page.locator('main .figwrap, main section > figure.diagram, main section > .cases, main section > figure.chart, main section > figure.waffle, main section > .custom-fig');
      const n = Math.min(await figs.count(), 10);
      closeups = [];
      for (let i = 0; i < n; i++) {
        const file = shot.replace(/\.png$/, `-fig-${i + 1}.png`);
        try {
          await figs.nth(i).screenshot({ path: file });
          closeups.push(file);
        } catch { /* hidden or detached figure */ }
      }
      await page.close();
      // One contact sheet of all close-ups: one image to read instead of one per figure.
      if (closeups.length > 1) {
        const sheet = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const cells = closeups.map((f, i) => `<figure><figcaption>Fig. ${i + 1}</figcaption><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"></figure>`).join('');
        await sheet.setContent(`<style>body{margin:0;padding:12px;font:600 18px system-ui;background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}figure{margin:0;border:1px solid #ccc;padding:6px}img{width:100%;display:block}</style>${cells}`);
        await sheet.waitForTimeout(100);
        // grid rows size to the tallest figure; fine for a critique sheet
        sheetFile = shot.replace(/\.png$/, '-figs.png');
        await sheet.screenshot({ path: sheetFile, fullPage: true });
        await sheet.close();
      }
    }
    if (section && shot) {
      // A sharp close-up of one section: full-page shots are too small to read detail.
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
      await page.goto(pathToFileURL(htmlPath).href);
      const sel = /^\d+$/.test(section) ? `main > section:nth-of-type(${section})` : `main > section[id="${section}"]`;
      const el = page.locator(sel).first();
      if (await el.count()) {
        shot = shot.replace(/\.png$/, `-section-${section}.png`);
        await el.screenshot({ path: shot });
      } else problems.push({ level: 'error', where: 'check', message: `no section "${section}" (use its number or id)` });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const seen = new Set();
  return {
    problems: problems.filter((p) => {
      const k = p.message + p.where.replace(/^\w+ · /, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
    shot,
    closeups,
    sheet: sheetFile,
  };
}

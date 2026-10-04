(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } },
  };
  const pageKey = 'lucid:' + (document.title || location.pathname);
  const params = new URLSearchParams(location.search);

  /* theme */
  const savedTheme = store.get('lucid:theme');
  if (savedTheme && !root.dataset.theme) root.dataset.theme = savedTheme;
  $('[data-act="theme"]')?.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('lucid:theme', root.dataset.theme);
  });

  /* copy the draft */
  $('[data-act="source"]')?.addEventListener('click', async (e) => {
    const text = $('#lucid-source').textContent;
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    const b = e.currentTarget; const t = b.textContent; b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = t), 1400);
  });

  /* sticky title + contents highlight */
  addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 120), { passive: true });
  const tocLinks = new Map($$('.toc a').map((a) => [a.getAttribute('href').slice(1), a]));
  if (tocLinks.size && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) {
        tocLinks.forEach((a) => a.classList.remove('on'));
        tocLinks.get(en.target.id)?.classList.add('on');
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('main > section').forEach((s) => io.observe(s));
  }

  /* step-through diagrams */
  for (const fig of $$('figure.playable')) {
    const n = +fig.dataset.steps || 0;
    const items = $$('[data-step]', fig);
    const cap = $('.caption', fig);
    const count = $('.count', fig);
    let cur = 0; let timer = null;
    const noteOf = (k) => items.find((el) => +el.dataset.step === k && el.dataset.note)?.dataset.note || '';
    const go = (k) => {
      cur = Math.max(0, Math.min(n, k));
      if (!cur) {
        fig.classList.remove('stepping');
        items.forEach((el) => el.classList.remove('now', 'future'));
        if (cap) cap.textContent = 'Press ▶ or › to walk through it.';
        if (count) count.textContent = n + ' steps';
        return;
      }
      fig.classList.add('stepping');
      for (const el of items) {
        const s = +el.dataset.step;
        el.classList.toggle('future', s > cur);
        el.classList.toggle('now', s === cur && !el.classList.contains('node'));
      }
      if (cap) cap.textContent = noteOf(cur);
      if (count) count.textContent = cur + ' / ' + n;
    };
    const stop = () => { clearInterval(timer); timer = null; const p = $('[data-act="play"]', fig); if (p) p.textContent = '▶'; };
    fig.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'next') { stop(); go(cur >= n ? 0 : cur + 1); }
      if (act === 'prev') { stop(); go(cur - 1); }
      if (act === 'play') {
        if (timer) return stop();
        e.target.textContent = '❚❚';
        if (cur >= n) go(0);
        go(cur + 1);
        timer = setInterval(() => (cur >= n ? (stop(), setTimeout(() => go(0), 1600)) : go(cur + 1)), 1900);
      }
    });
    fig.lucid = { n, go, noteOf, stop };
  }

  /* hover previews: code refs and glossary terms */
  const tip = $('.snip');
  const show = (el, text, cls) => {
    if (!tip) return;
    tip.className = 'snip' + (cls ? ' ' + cls : '');
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth; const h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    tip.style.top = (r.bottom + h + 12 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  };
  const hide = () => tip && (tip.hidden = true);
  document.addEventListener('mouseover', (e) => {
    const ref = e.target.closest('a.ref[data-snip]');
    const term = e.target.closest('abbr.term');
    if (ref) show(ref, ref.dataset.snip);
    else if (term) show(term, term.dataset.def, 'term');
  });
  document.addEventListener('mouseout', (e) => { if (e.target.closest('a.ref, abbr.term')) hide(); });
  document.addEventListener('focusin', (e) => { const r = e.target.closest('a.ref[data-snip]'); if (r) show(r, r.dataset.snip); });
  document.addEventListener('focusout', hide);

  /* glossary: mark the first use of each term in every section */
  let gloss = {};
  try { gloss = JSON.parse($('#lucid-glossary')?.textContent || '{}'); } catch { /* ignore */ }
  const terms = Object.keys(gloss).sort((a, b) => b.length - a.length);
  if (terms.length) {
    const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const sec of $$('main > section')) {
      const seen = new Set();
      const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => n.parentElement.closest('code, pre, a, abbr, svg, h2, .glossary, button, figure.code') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        for (const t of terms) {
          if (seen.has(t)) continue;
          const re = new RegExp('(^|[^\\w])(' + escRe(t) + ')(?![\\w])', t === t.toUpperCase() ? '' : 'i');
          const m = node.nodeValue.match(re);
          if (!m) continue;
          seen.add(t);
          const at = m.index + m[1].length;
          const after = node.splitText(at);
          after.nodeValue = after.nodeValue.slice(m[2].length);
          const ab = document.createElement('abbr');
          ab.className = 'term'; ab.textContent = m[2]; ab.dataset.def = t + ': ' + gloss[t]; ab.tabIndex = 0;
          node.parentNode.insertBefore(ab, after);
          break;
        }
      }
    }
  }

  /* linked highlighting: names in the prose light up the matching part of the section's diagram */
  for (const sec of $$('main > section')) {
    const figs = $$('figure.diagram', sec);
    if (!figs.length) continue;
    const names = [...new Set(figs.flatMap((f) => $$('[data-id]', f).map((g) => g.dataset.id)))].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
    if (!names.length) continue;
    const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^\\w])(' + names.map(escRe).join('|') + ')(?![\\w])');
    const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.parentElement.closest('svg, code, pre, a, abbr, h2, button, .xref, figure.code, .player') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (let node of nodes) {
      let m;
      while (node && (m = node.nodeValue.match(re))) {
        const at = m.index + m[1].length;
        const after = node.splitText(at);
        node = after.splitText(m[2].length);
        const span = document.createElement('span');
        span.className = 'xref'; span.dataset.x = m[2]; span.tabIndex = 0;
        after.replaceWith(span); span.append(after);
      }
    }
    const light = (name, on) => {
      for (const f of figs) {
        f.classList.toggle('linking', on);
        $$('[data-id], [data-from]', f).forEach((g) => g.classList.toggle('lit', on && (g.dataset.id === name || g.dataset.from === name || g.dataset.to === name)));
      }
    };
    sec.addEventListener('mouseover', (e) => { const x = e.target.closest('.xref'); if (x) light(x.dataset.x, true); });
    sec.addEventListener('mouseout', (e) => { const x = e.target.closest('.xref'); if (x) light(x.dataset.x, false); });
    sec.addEventListener('focusin', (e) => { const x = e.target.closest('.xref'); if (x) light(x.dataset.x, true); });
    sec.addEventListener('focusout', (e) => { const x = e.target.closest('.xref'); if (x) light(x.dataset.x, false); });
  }

  /* quiz */
  for (const quiz of $$('.quiz')) {
    let right = 0; let done = 0; const total = $$('.q', quiz).length;
    const score = $('.score', quiz);
    const finish = (q, ok) => {
      if (q.dataset.done) return;
      q.dataset.done = '1'; done++; if (ok) right++;
      $$('.owhy', q).forEach((w) => w.removeAttribute('hidden'));
      $('.why', q)?.removeAttribute('hidden');
      if (score && done === total) score.textContent = right + ' of ' + total + ' right on the first try.';
    };
    quiz.addEventListener('click', (e) => {
      const q = e.target.closest('.q'); if (!q) return;
      if (e.target.closest('.reveal')) { $('.ans', q).hidden = false; e.target.closest('.reveal').hidden = true; finish(q, true); return; }
      const opt = e.target.closest('.opt'); if (!opt || q.dataset.done) return;
      const ok = opt.dataset.ok === 'true';
      opt.classList.add(ok ? 'right' : 'wrong');
      opt.querySelector('.owhy')?.removeAttribute('hidden');
      const multi = q.dataset.multi === 'true';
      if (!ok) { q.dataset.miss = '1'; $$('.opt', q).forEach((o) => o.dataset.ok === 'true' && o.classList.add('right')); finish(q, false); return; }
      const all = $$('.opt', q).filter((o) => o.dataset.ok === 'true').every((o) => o.classList.contains('right'));
      if (!multi || all) finish(q, !q.dataset.miss);
    });
  }

  /* checklist */
  for (const cl of $$('.checklist')) {
    const boxes = $$('input', cl);
    const prog = $('.progress span', cl);
    const update = () => { if (prog) prog.textContent = boxes.filter((b) => b.checked).length; };
    for (const b of boxes) {
      const k = pageKey + ':' + b.dataset.k; const v = store.get(k);
      if (v !== null) b.checked = v === '1';
      b.addEventListener('change', () => { store.set(k, b.checked ? '1' : '0'); update(); });
    }
    update();
  }

  /* tour: a narrated walk through the page; the video exporter drives the same code */
  const bar = $('.tourbar');
  const tcap = $('.tcap');
  const segments = () => {
    const out = [];
    for (const sec of $$('main > section')) {
      if (sec.classList.contains('appendix') && !params.has('all')) continue;
      out.push({ sec, text: sec.dataset.say || sec.querySelector('h2')?.textContent || '' });
      const fig = $('figure.playable', sec);
      if (fig?.lucid && fig.lucid.n > 1) for (let k = 1; k <= fig.lucid.n; k++) out.push({ sec, fig, step: k, text: fig.lucid.noteOf(k) });
    }
    const tldr = $('.tldr p');
    if (tldr) out.unshift({ sec: $('.hero'), text: (document.querySelector('.hero h1')?.textContent || '') + '. ' + tldr.textContent });
    return out;
  };
  let segs = []; let idx = -1; let timer = null; let paused = false;
  const timings = window.LUCID_TIMINGS || null; // seconds per segment, set by the video exporter
  const voice = 'speechSynthesis' in window && !params.has('video') && !params.has('mute');
  const estimate = (t) => Math.max(2.2, t.split(/\s+/).length / 2.7 + 0.8);
  const clear = () => { clearTimeout(timer); if (voice) speechSynthesis.cancel(); };
  const play = (k) => {
    clear();
    $$('.touring').forEach((s) => s.classList.remove('touring'));
    if (k < 0) k = 0;
    if (k >= segs.length) return endTour();
    idx = k;
    const s = segs[k];
    s.sec.classList.add('touring');
    if (!s.fig || s.step === 1) s.sec.scrollIntoView({ behavior: params.has('video') ? 'instant' : 'smooth', block: s.sec.offsetHeight > innerHeight * 0.8 ? 'start' : 'center' });
    $$('figure.playable').forEach((f) => f !== s.fig && f.lucid.go(0));
    if (s.fig) s.fig.lucid.go(s.step);
    tcap.textContent = s.text;
    if (paused) return;
    const dur = timings ? timings[k] : estimate(s.text);
    if (voice && !timings) {
      const u = new SpeechSynthesisUtterance(s.text);
      u.rate = 1.04;
      let moved = false;
      const next = () => { if (!moved && idx === k && !paused) { moved = true; play(k + 1); } };
      u.onend = next;
      speechSynthesis.speak(u);
      timer = setTimeout(next, (dur * 1.6 + 2) * 1000);
    } else timer = setTimeout(() => play(k + 1), dur * 1000);
  };
  const endTour = () => {
    clear(); idx = -1;
    $$('.touring').forEach((s) => s.classList.remove('touring'));
    $$('figure.playable').forEach((f) => f.lucid.go(0));
    if (bar) bar.hidden = true;
    window.lucidTourDone = true;
  };
  const startTour = () => { segs = segments(); paused = false; window.lucidTourDone = false; if (bar) bar.hidden = false; play(0); };
  $('[data-act="tour"]')?.addEventListener('click', startTour);
  bar?.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'tnext') play(idx + 1);
    if (act === 'tprev') play(idx - 1);
    if (act === 'tstop') endTour();
    if (act === 'tpause') { paused = !paused; e.target.textContent = paused ? '▶' : '❚❚'; if (paused) clear(); else play(idx); }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && idx >= 0) endTour(); });
  window.lucidSegments = () => segments().map((s) => s.text);
  window.lucidStartTour = startTour;
  if (params.has('video')) document.body.classList.add('video');
  if (params.has('tour')) addEventListener('load', () => setTimeout(startTour, 300));
})();

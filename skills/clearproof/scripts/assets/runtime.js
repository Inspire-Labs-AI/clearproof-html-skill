(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } },
  };
  const pageKey = 'clearproof:' + (document.title || location.pathname);
  const params = new URLSearchParams(location.search);

  /* theme */
  const savedTheme = store.get('clearproof:theme');
  if (savedTheme && !root.dataset.theme) root.dataset.theme = savedTheme;
  $('[data-act="theme"]')?.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('clearproof:theme', root.dataset.theme);
  });

  /* copy the draft */
  $('[data-act="source"]')?.addEventListener('click', async (e) => {
    const text = $('#clearproof-source').textContent;
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

  /* wide architecture diagrams on a phone: start centred, scroll sideways */
  for (const f of $$('.arch-fig')) if (f.scrollWidth > f.clientWidth) f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;

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
    fig.clearproof = { n, go, noteOf, stop };
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
  try { gloss = JSON.parse($('#clearproof-glossary')?.textContent || '{}'); } catch { /* ignore */ }
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

  /* figure kit: bespoke figures get consistent controls and theme colours */
  const NS = 'http://www.w3.org/2000/svg';
  const make = (ns) => (tag, attrs = {}, ...kids) => {
    const el = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  const controls = (fig) => fig.querySelector(':scope > .fig-controls') || fig.appendChild(Object.assign(document.createElement('div'), { className: 'fig-controls' }));
  const L = {
    el: make(false),
    svg: make(true),
    color: (name) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim(),
    readout(fig, label) {
      const v = L.el('b', {}, '–');
      controls(fig).append(L.el('span', { class: 'readout' }, `${label} `, v));
      return { set: (x) => { v.textContent = x; } };
    },
    toggle(fig, labels, onChange, initial = 0) {
      const box = L.el('span', { class: 'seg', role: 'group' });
      const btns = labels.map((t, i) => L.el('button', { type: 'button', 'aria-pressed': String(i === initial), onclick: () => { btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); onChange(i); } }, t));
      box.append(...btns);
      controls(fig).prepend(box);
      return { set: (i) => btns[i].click() };
    },
    slider(fig, o, onInput) {
      const out = L.el('output', {}, o.format ? o.format(o.value) : String(o.value));
      const input = L.el('input', { type: 'range', min: o.min, max: o.max, step: o.step ?? 1, value: o.value });
      input.addEventListener('input', () => { const v = Number(input.value); out.textContent = o.format ? o.format(v) : String(v); onInput(v); });
      controls(fig).append(L.el('label', { class: 'slider' }, `${o.label} `, input, out));
      return { set: (v) => { input.value = v; input.dispatchEvent(new Event('input')); } };
    },
    player(fig, o) {
      let cur = o.start ?? o.steps - 1; let timer = null;
      const count = L.el('span', { class: 'count' });
      const cap = o.labels ? L.el('span', { class: 'caption' }) : null;
      const go = (k) => { cur = Math.max(0, Math.min(o.steps - 1, k)); count.textContent = `${cur + 1} / ${o.steps}`; if (cap) cap.textContent = o.labels[cur] || ''; o.onStep(cur); };
      const stop = () => { clearInterval(timer); timer = null; play.textContent = '▶'; };
      const play = L.el('button', { type: 'button', 'aria-label': 'Play', onclick: () => {
        if (timer) return stop();
        if (cur >= o.steps - 1) go(0);
        play.textContent = '❚❚';
        timer = setInterval(() => (cur >= o.steps - 1 ? stop() : go(cur + 1)), o.interval ?? 800);
      } }, '▶');
      const bar = L.el('div', { class: 'player' },
        L.el('button', { type: 'button', 'aria-label': 'Previous', onclick: () => { stop(); go(cur - 1); } }, '‹'),
        play,
        L.el('button', { type: 'button', 'aria-label': 'Next', onclick: () => { stop(); go(cur + 1); } }, '›'),
        count, cap);
      controls(fig).append(bar);
      go(cur); // start on the most informative frame (the end state unless o.start says otherwise)
      return { go, stop, get step() { return cur; } };
    },
  };
  // Parts marked data-s="k" appear at step k; the current step is accented, future steps fade (text hidden).
  L.steps = (fig, captions, o = {}) => {
    const parts = [...fig.querySelectorAll('[data-s]')];
    const n = captions?.length || Math.max(...parts.map((p) => +p.dataset.s));
    return L.player(fig, { steps: n, labels: captions, start: o.start, interval: o.interval ?? 1600, onStep: (k) => {
      for (const p of parts) { const s = +p.dataset.s; p.classList.toggle('future', s > k + 1); p.classList.toggle('now', s === k + 1); }
      o.onStep?.(k);
    } });
  };
  // One drawing, two states: .only-before / .only-after parts swap; what stays put is what did not change.
  L.beforeAfter = (fig, labels = ['Before', 'After'], initial = 1) => {
    const set = (i) => { fig.dataset.view = i ? 'after' : 'before'; };
    set(initial);
    return L.toggle(fig, labels, set, initial);
  };
  window.L = L;
  for (const fig of $$('[data-fig]')) {
    const src = $('.fig-src', fig)?.textContent;
    if (!src) continue;
    try { new Function('fig', 'L', src)(fig, L); } catch (err) {
      console.error(`figure ${fig.id}: ${err.message}`);
      fig.append(L.el('p', { class: 'fig-error' }, `This figure failed to run: ${err.message}`));
    }
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
      if (fig?.clearproof && fig.clearproof.n > 1) for (let k = 1; k <= fig.clearproof.n; k++) out.push({ sec, fig, step: k, text: fig.clearproof.noteOf(k) });
    }
    const tldr = $('.tldr p');
    if (tldr) out.unshift({ sec: $('.hero'), text: (document.querySelector('.hero h1')?.textContent || '') + '. ' + tldr.textContent });
    return out;
  };
  let segs = []; let idx = -1; let timer = null; let paused = false;
  const timings = window.CLEARPROOF_TIMINGS || null; // seconds per segment, set by the video exporter
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
    $$('figure.playable').forEach((f) => f !== s.fig && f.clearproof.go(0));
    if (s.fig) s.fig.clearproof.go(s.step);
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
    $$('figure.playable').forEach((f) => f.clearproof.go(0));
    if (bar) bar.hidden = true;
    window.clearproofTourDone = true;
  };
  const startTour = () => { segs = segments(); paused = false; window.clearproofTourDone = false; if (bar) bar.hidden = false; play(0); };
  $('[data-act="tour"]')?.addEventListener('click', startTour);
  bar?.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'tnext') play(idx + 1);
    if (act === 'tprev') play(idx - 1);
    if (act === 'tstop') endTour();
    if (act === 'tpause') { paused = !paused; e.target.textContent = paused ? '▶' : '❚❚'; if (paused) clear(); else play(idx); }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && idx >= 0) endTour(); });
  window.clearproofSegments = () => segments().map((s) => s.text);
  window.clearproofStartTour = startTour;
  if (params.has('video')) document.body.classList.add('video');
  if (params.has('tour')) addEventListener('load', () => setTimeout(startTour, 300));
})();

---
kicker: The clearproof method
title: Answer first, draw the mechanism, prove every number, then check the page like a judge.
tldr: The method works for any question where a reader must **understand and trust** the answer: code, money, science, health, policy, a decision.
for: anyone who wants to use clearproof, on tech topics or not
---

## The hero {hero}
```flow LR caption="Five steps turn a question into a page. The model writes words; the tool draws, runs and checks."
(Question) -> Plan: 1 | Plan: write the answer as one sentence, then pick the hero figure.
Plan -> Draw: 2 | Draw: one claim per section, each proved by a figure with real values.
Draw -> *Prove: 3 | Prove: real code, real command output, sources. Nothing typed in by hand.
*Prove -> Check: 4 | Check: lint the prose, render at desktop and phone, flag overlaps and mismatched numbers.
Check -> Critique: 5 | Critique: read each figure close-up, score it like a judge, fix the 3 weakest.
Critique -> (Page)
```

## 1. Plan: the title is the answer, not the topic {kicker="Plan"}
Write the one sentence the reader must leave with. Put the key number first. Then pick the **hero figure** that makes that sentence visible on the first screen.

| Question type | Title | Hero figure |
|---|---|---|
| How does X work? | "GC pause time grows with what survives, not with the garbage" | the mechanism, stepped, with real values |
| How much? Which is better? | "₹7.99 lakh saved by prepaying ₹2 lakh in year 1" | the number, highlighted and annotated |
| Should we merge this? | "Do not merge: reset tokens work only after they expire" | the verdict, then the proof |

## 2. Draw: one claim per section, one figure per claim {kicker="Draw"}
Each section title is a claim. Each claim gets the figure that proves it. Pick the form by the shape of the information, not by habit.

```figure caption="Pick the figure by the shape of the information: a process steps, a setting slides, quantities compare, cases repeat." [wide]
<div class="forms" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px"></div>
<script>
const box = fig.querySelector('.forms');
const A = L.color('accent'), G = L.color('line'), R = L.color('risk'), I = L.color('ink-3');
const card = (title, use, draw) => {
  const s = L.svg('svg', { viewBox: '0 0 200 110', width: '100%' });
  draw(s);
  box.append(L.el('div', { style: 'border:1px solid var(--line);border-radius:10px;padding:12px' },
    L.el('div', { style: 'font-weight:700' }, title), s, L.el('div', { class: 'muted', style: 'font-size:14px' }, use)));
};
card('A process → stepper', 'GC marking, a TCP handshake, a recipe', (s) => {
  [30, 100, 170].forEach((x, i) => {
    s.append(L.svg('circle', { cx: x, cy: 40, r: 16, fill: i === 1 ? A : 'none', stroke: i === 1 ? A : I, 'stroke-width': 2 }));
    if (i < 2) s.append(L.svg('line', { x1: x + 18, y1: 40, x2: x + 52, y2: 40, stroke: I, 'stroke-width': 2 }));
  });
  s.append(L.svg('text', { x: 100, y: 90, 'text-anchor': 'middle', 'font-size': 14 }, 'step 2 of 3: one caption'));
});
card('A setting → live figure', 'prepayment year, cache size, dose', (s) => {
  [70, 55, 40, 28, 18].forEach((h, i) => s.append(L.svg('rect', { x: 30 + i * 30, y: 70 - h, width: 22, height: h, fill: i === 1 ? A : G })));
  s.append(L.svg('line', { x1: 30, y1: 92, x2: 172, y2: 92, stroke: I, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  s.append(L.svg('circle', { cx: 71, cy: 92, r: 8, fill: A }));
});
card('Quantities → chart', 'savings by year, latency, cost', (s) => {
  [[90, 1], [60, 0], [34, 0], [16, 0]].forEach(([w, hot], i) => {
    s.append(L.svg('rect', { x: 20, y: 10 + i * 24, width: w * 1.5, height: 16, rx: 3, fill: hot ? A : G }));
  });
  s.append(L.svg('text', { x: 160, y: 23, 'font-size': 14, 'font-weight': 700 }, '6.5×'));
});
card('Options → small multiples', 'failure modes, plans, scenarios', (s) => {
  [0, 1, 2].forEach((k) => {
    const x = 10 + k * 64;
    s.append(L.svg('rect', { x, y: 20, width: 56, height: 70, rx: 6, fill: 'none', stroke: G }));
    s.append(L.svg('circle', { cx: x + 16, cy: 55, r: 8, fill: I }));
    s.append(L.svg('circle', { cx: x + 40, cy: 55, r: 8, fill: k === 2 ? R : I }));
    s.append(L.svg('line', { x1: x + 24, y1: 55, x2: x + 32, y2: 55, stroke: I, 'stroke-width': 2 }));
  });
});
</script>
```

## 3. Prove: the page shows its evidence {kicker="Prove"}
A number on the page must come from somewhere the reader can check. clearproof runs the real code at render time and prints the output. It warns when a chart value does not appear in that output.

```run
$ node examples/home-loan/loan.mjs prepay
shows: Year 1: saves ₹7.99 lakh
note: The loan page does not type its numbers. It runs this calculator and quotes its output.
```

| Domain | Where proof comes from |
|---|---|
| Code and systems | `[[file:line]]` references read from disk, `run` blocks that call the real code, diff hunks from git |
| Money | a calculator in the repo, run at render time; rates and rules cited with links |
| Science, health | linked sources, labelled measurements, "illustrative" on every simplified model |
| Decisions, policy | a `claims` ledger: verified, inferred, unverified, each with its basis |

```claims
verified | The loan figures on this page come from a script, not from the model. | run
verified | Every page is checked at 1280 px and 390 px before it is shown. | [[skills/clearproof/scripts/lib/check.mjs:1]]
inferred | The method helps any reader who must trust a number. | Blind judges scored trust highest on clearproof pages in every round.
```

## 4. Check: the tool reads the page before you do {kicker="Check"}
The model never sees its own page by default. clearproof makes it look.

```checklist
- Plain English: one idea per sentence, 25 words at most, active voice (ASD-STE100 style).
- One number per quantity: the render lists every number by unit, so "16 GB" and "15 GB" for the same heap stand out.
- Layout at desktop and phone width: overflow, cut-off tables, overlapping labels, text too small to read.
- Screenshots of the whole page and of each figure, for the next step.
```

## 5. Critique: score it like a blind judge, then fix {kicker="Critique"}
Read each figure close-up and score four things. Fix the three weakest before you answer.

```chart bar unit=points caption="clearproof's average explainer score in round 4 was 18.0 of 20, ahead of 17.5 for visual-explainer."
*clearproof | 18.0 ! figure-first pages plus the critique pass
visual-explainer | 17.5
plain HTML | 14.0
answer-me-with-html | 13.5
```

```run
$ grep "Explain average" BENCHMARK.md
shows: 18.0
note: The chart quotes the benchmark record, not memory.
```

| Score | Question the judge asks |
|---|---|
| Clarity | Can I state the answer after the first screen? |
| Visuals | Does each figure show the mechanism, with real values? |
| Readability | Short sentences, labels in the picture, no wall of text? |
| Trust | Can I check each claim? Does each number agree everywhere? |

## When not to use it
```callout info Skip the page
One-line answers, commands to copy, quick code edits, or "plain text please". The method costs about 3 minutes. Spend them when the reader must understand or decide.
```

## Check yourself
```quiz
? A friend asks "is a 15-year or a 30-year mortgage better for me?" What is the hero figure?
- [x] A chart of total interest and monthly payment for both, the key number highlighted :: Yes. It is a "which is better" question, so the hero is the number.
- [ ] A flow diagram of how a bank approves a loan :: That answers a different question.
- [ ] A glossary of loan terms :: Terms help, but they do not show the answer.
? Where should the numbers on that page come from?
- [x] A small calculator, run at render time, its output shown on the page :: Yes. Then the reader can check them, and the page cannot drift from the math.
- [ ] The model's memory of typical rates :: The model can misremember. Proof beats assertion.
```

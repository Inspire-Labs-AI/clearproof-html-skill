---
kicker: Home loans · prepayment
title: ₹7.99 lakh saved by prepaying ₹2 lakh in year 1. In year 15, only ₹1.23 lakh.
tldr: Early EMIs are mostly **interest on the full balance**, so every rupee you prepay early stops interest for many more years.
for: someone with a ₹50 lakh home loan at 8.5% for 20 years who wonders whether to prepay
---

## The hero {hero}
```figure caption="Move the prepayment later and watch the saving shrink: early years are mostly interest (red)." [wide]
<svg class="bars" viewBox="0 0 900 330" width="100%" role="img" aria-label="Interest and principal paid each year"></svg>
<script>
const P = 5000000, r = 8.5 / 1200, N = 240;
const emi = Math.round(P * r * (1 + r) ** N / ((1 + r) ** N - 1));
// Same model as examples/home-loan/loan.mjs: monthly reducing balance, EMI fixed, tenure shrinks.
function model(year, amount) {
  let bal = P, m = 0, total = 0; const yrs = [];
  while (bal > 0.5) {
    m++;
    const i = bal * r, pay = Math.min(emi, bal + i);
    bal = Math.max(0, bal + i - pay - (m === (year - 1) * 12 + 1 ? amount : 0));
    total += i;
    const y = Math.ceil(m / 12) - 1;
    yrs[y] = yrs[y] || { i: 0, p: 0 };
    yrs[y].i += i; yrs[y].p += pay - i;
  }
  return { total, months: m, yrs };
}
const base = model(1, 0);
const svg = fig.querySelector('svg.bars');
const saved = L.readout(fig, 'Interest saved');
const early = L.readout(fig, 'Loan ends early by');
let year = 1, amount = 200000;
const lakh = (x) => '₹' + (x / 1e5).toFixed(2) + ' lakh';
function draw() {
  const s = model(year, amount);
  svg.replaceChildren();
  const max = emi * 12, w = 38, gap = 4, x0 = 40, h = 220, top = 56;
  svg.append(L.svg('text', { x: x0, y: 18, 'font-size': 14, class: 'muted' }, 'Each bar = one year of EMIs (₹5.21 lakh). Red = interest, green = principal, dashed = a year you no longer pay.'));
  for (let y = 0; y < 20; y++) {
    const x = x0 + y * (w + gap), d = s.yrs[y];
    if (!d) {
      svg.append(L.svg('rect', { x, y: top, width: w, height: h, fill: 'none', stroke: L.color('ok'), 'stroke-dasharray': '4 3' }));
    } else {
      const hi = d.i / max * h, hp = d.p / max * h;
      svg.append(L.svg('rect', { x, y: top + h - hi - hp, width: w, height: hp, fill: L.color('ok'), opacity: 0.55 }));
      svg.append(L.svg('rect', { x, y: top + h - hi, width: w, height: hi, fill: L.color('risk'), opacity: 0.8 }));
    }
    if (y === year - 1) svg.append(L.svg('text', { x: x + w / 2, y: top - 8, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, '▼ prepay'));
    svg.append(L.svg('text', { x: x + w / 2, y: top + h + 20, 'text-anchor': 'middle', 'font-size': 13, class: 'muted' }, String(y + 1)));
  }
  svg.append(L.svg('text', { x: x0, y: top + h + 42, 'font-size': 13, class: 'muted' }, 'Year of the loan'));
  saved.set(lakh(base.total - s.total));
  early.set((base.months - s.months) + ' months');
}
L.slider(fig, { label: 'Prepay in year', min: 1, max: 19, step: 1, value: 1, format: (v) => 'year ' + v }, (v) => { year = v; draw(); });
L.slider(fig, { label: 'Amount', min: 50000, max: 500000, step: 50000, value: 200000, format: (v) => lakh(v) }, (v) => { amount = v; draw(); });
draw();
</script>
```

## Four numbers set everything {kicker="The parts"}
- **Principal:** what you borrowed, ₹50 lakh.
- **Rate:** 8.5% a year, charged monthly on what you still owe.
- **EMI:** the fixed monthly payment, ₹43,391. It pays that month's interest first. The rest cuts the principal.
- **Tenure:** 20 years, or 240 EMIs. Together you pay ₹104.14 lakh, so ₹54.14 lakh is interest.

```run
$ node examples/home-loan/loan.mjs summary
shows: Total interest: ₹54.14 lakh
note: The real calculator behind every number on this page (examples/home-loan/loan.mjs).
```

## In the first year, 82% of each EMI is interest {kicker="Mechanism"}
The bank charges interest on the balance you still owe. At the start you owe all ₹50 lakh, so interest takes most of the EMI. The principal falls slowly at first, then faster.

```quiz
? Predict: in year 10 of 20, how much of the EMI is interest?
- [ ] About half, because you are halfway :: Halfway in time is not halfway in debt. You still owe about ₹37 lakh of the ₹50 lakh.
- [x] About 61% :: Correct. The balance is still large in year 10, so interest still takes most of the EMI.
- [ ] About 20% :: That happens only in the last few years, when the balance is small.
```

```chart bar unit=% caption="Interest share of the same ₹43,391 EMI falls from 82% to 8% over the loan."
*Year 1 | 82 ! ₹35,417 of ₹43,391 is interest
Year 5 | 74
Year 10 | 61
Year 15 | 40
Year 20 | 8
```

```run
$ node examples/home-loan/loan.mjs split
shows: Month 1: interest ₹35,417 of ₹43,391 (82%)
note: Interest share of the EMI, computed month by month.
```

## The same ₹2 lakh saves 6.5× more in year 1 than in year 15 {kicker="Timing"}
A prepayment cuts the principal at once. Every later month then charges interest on a smaller balance. An early prepayment has more months left to save on.

```chart bar unit=lakh caption="Interest saved by one ₹2 lakh prepayment, by the year you make it."
*Year 1 | 7.99 ! ends 24 months early
Year 5 | 5.28
Year 10 | 2.86
Year 15 | 1.23
```

```run
$ node examples/home-loan/loan.mjs prepay
shows: Year 1: saves ₹7.99 lakh, ends 24 months early
note: One ₹2 lakh prepayment; the EMI stays the same and the loan ends sooner.
```

## A steady ₹5,000 a month ends the loan 4.4 years early {kicker="Habit"}
You do not need a lump sum. ₹5,000 extra every month, from month 1, saves ₹13.89 lakh and ends the loan after 15.6 years instead of 20.

```run
$ node examples/home-loan/loan.mjs monthly
shows: saves ₹13.89 lakh, loan ends after 15.6 years
note: ₹5,000 added to every EMI from the first month.
```

## Check these before you prepay {kicker="Limits"}
```checklist
- Keep an emergency fund of 6 months of expenses first. Money in the loan is hard to get back.
- Clear costlier debt first. A credit card at 36% costs far more than a home loan at 8.5%.
- Compare with what the money would earn elsewhere, after tax. Prepaying "earns" exactly your loan rate.
- Ask the bank to keep the EMI and cut the tenure. That saves more interest than a lower EMI.
- Check prepayment charges in your loan terms.
```

```callout info What this page simplifies
The model uses a fixed 8.5% rate, monthly reducing balance, and prepayment at the start of a year. Real floating rates change, and tax rules differ by person. Use the calculator with your own numbers.
```

## Check yourself
```quiz
? You get a ₹1 lakh bonus in year 2 and another in year 12. Which one saves more interest if you prepay it?
- [x] The year-2 bonus :: Yes. It removes principal that would otherwise collect interest for 18 more years.
- [ ] The year-12 bonus :: It helps, but only 8 years of interest remain to save.
- [ ] Both save the same :: The amount is the same, but the number of months left is not.
? The bank offers: keep the EMI and cut the tenure, or keep the tenure and cut the EMI. Which saves more interest?
- [x] Keep the EMI, cut the tenure :: Yes. You keep paying down principal at the same pace, so the balance falls faster.
- [ ] Keep the tenure, cut the EMI :: A lower EMI pays off principal more slowly, so more interest builds up.
```

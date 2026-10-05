// Home-loan amortization: monthly reducing balance, the way Indian banks compute EMI.
// Usage: node loan.mjs <summary|prepay|split|share> — prints the numbers the page quotes.
export const P = 5_000_000, RATE = 8.5, YEARS = 20;
const r = RATE / 12 / 100, N = YEARS * 12;
export const emi = Math.round(P * r * (1 + r) ** N / ((1 + r) ** N - 1));

// Run the loan month by month. prepay: { month: amount }. The EMI stays the same; the tenure shrinks.
export function run(prepay = {}) {
  let bal = P, interest = 0, months = 0;
  while (bal > 0.5) {
    months++;
    const i = bal * r;
    const pay = Math.min(emi, bal + i);
    bal = bal + i - pay - (prepay[months] || 0);
    if (bal < 0) bal = 0;
    interest += i;
  }
  return { interest: Math.round(interest), months };
}

const lakh = (x) => (x / 1e5).toFixed(2) + ' lakh';
const cmd = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  const base = run();
  if (cmd === 'summary') {
    console.log(`EMI: ₹${emi.toLocaleString('en-IN')}`);
    console.log(`Total interest: ₹${lakh(base.interest)}`);
    console.log(`Total paid: ₹${lakh(base.interest + P)}`);
  }
  if (cmd === 'split') {
    // How much of the first and the last EMI is interest.
    const first = P * r, lastBal = (() => { let b = P; for (let m = 1; m < N; m++) b = b * (1 + r) - emi; return b; })();
    console.log(`Month 1: interest ₹${Math.round(first).toLocaleString('en-IN')} of ₹${emi.toLocaleString('en-IN')} (${Math.round(first / emi * 100)}%)`);
    for (const y of [1, 5, 10, 15, 20]) {
      let b = P; for (let m = 1; m < (y - 1) * 12 + 1; m++) b = b * (1 + r) - emi;
      console.log(`Year ${y}: ${Math.round(b * r / emi * 100)}% of the EMI is interest`);
    }
    console.log(`Month 240: interest ₹${Math.round(lastBal * r).toLocaleString('en-IN')}`);
  }
  if (cmd === 'prepay') {
    // One ₹2 lakh prepayment, made at the start of different years.
    for (const y of [1, 5, 10, 15]) {
      const p = run({ [(y - 1) * 12 + 1]: 200_000 });
      console.log(`Year ${y}: saves ₹${lakh(base.interest - p.interest)}, ends ${base.months - p.months} months early`);
    }
  }
  if (cmd === 'monthly') {
    // ₹5,000 extra every month from month 1.
    const extra = {}; for (let m = 1; m <= N; m++) extra[m] = 5000;
    const p = run(extra);
    console.log(`Extra ₹5,000 a month: saves ₹${lakh(base.interest - p.interest)}, loan ends after ${(p.months / 12).toFixed(1)} years`);
  }
}

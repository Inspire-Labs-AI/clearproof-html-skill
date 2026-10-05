import fs from 'fs';
const D = process.argv[2];
function units(t){ // sentence-like units: split on sentence end or newline
  return t.split(/\n+/).flatMap(l=>l.split(/(?<=[.!?])\s+(?=[A-Z"])/)).map(s=>s.trim()).filter(Boolean);
}
const wc = s => s.split(/\s+/).filter(Boolean).length;
for (const f of ['prompt_before','prompt_after','ans_before','ans_after']) {
  const t = fs.readFileSync(`${D}/${f}.txt`,'utf8');
  const u = units(t).map(wc);
  const total = wc(t), n=u.length, max=Math.max(...u), avg=(total/n).toFixed(1);
  const over = u.filter(x=>x>25).length;
  const hedge=(t.match(/\b(maybe|possibly|probably|generally|typically|might|could|hopefully|potentially|kind of|basically|perhaps|may)\b/gi)||[]).length;
  console.log(`${f.padEnd(14)} hedges=${hedge} words=${total} sentences=${n} avg=${avg} longest=${max} over25=${over}`);
}

/* Il backtest della proiezione dello spoglio (proxy/lib/modello.js).

   Si rifà lo spoglio di un'elezione vera partendo da quella precedente: aprile 2019 →
   novembre 2019, e novembre 2019 → luglio 2023. Ogni notte simulata ha un suo ordine di
   arrivo: ogni provincia un suo ritmo (le grandi più lente), dentro la provincia prima i
   comuni piccoli con un po' di caso, l'ultimo comune del momento contato in parte. In un
   secondo scenario l'ordine è del tutto casuale, per vedere se il modello regge anche quando
   le cose vanno diversamente.

   A ogni punto dello spoglio si confrontano con il risultato finale del conteggio (senza il
   voto dall'estero, che si conta giorni dopo):
   - il riparto sui voti contati fino a quel momento, cioè quello che mostra il Ministero;
   - la proiezione del modello, con la sua forchetta all'80%.
   «Seggi spostati» è la metà della somma degli scarti fra partiti.

   Uso:  node strumenti/backtest/backtest.mjs [notti=30]   (scrive strumenti/backtest/risultati.json) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proietta, famiglia, dhondt } from '../../proxy/lib/modello.js';

const QUI = path.dirname(fileURLToPath(import.meta.url)), RADICE = path.join(QUI, '..', '..');
const NOTTI = Number(process.argv[2]) || 30;

/* le regole dei partiti sono quelle della pagina: si leggono da index.html */
const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
const i0 = html.indexOf('const GRUPPI = ['), i1 = html.indexOf('];', i0);
const GRUPPI = new Function('return ' + html.slice(i0 + 'const GRUPPI = '.length, i1 + 1))();
const GMAP = Object.fromEntries(GRUPPI.map(g => [g.k, g]));
function gruppoDi(sigla, naz, nome) {
  if (naz && GMAP[naz] && naz === sigla) return naz;
  for (const s of [naz, sigla, nome]) {
    if (!s) continue;
    const t = String(s).replace(/[–—]/g, '-');
    const g = GRUPPI.find(x => x.re.test(t));
    if (g) return g.k;
  }
  return 'L:' + String(sigla || naz || '?').toUpperCase();
}
function carica(f) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8')), memo = {};
  const g = cod => memo[cod] || (memo[cod] = gruppoDi(d.partiti[cod][0], '', d.partiti[cod][1]));
  const m = {};
  for (const [ine, x] of Object.entries(d.m)) {
    const v = {}; for (let i = 0; i < x[6].length; i += 2) { const k = g(x[6][i]); v[k] = (v[k] || 0) + x[6][i + 1]; }
    m[ine] = { v, validi: x[5], mesas: x[1], nome: x[0] };
  }
  return { m, seggi: Object.fromEntries(Object.entries(d.prov).map(([p, x]) => [p, x[0]])) };
}

function rand(seed) { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
/* l'ordine di arrivo di una notte simulata, come nella prova generale della pagina */
function notte(T, seme, casuale) {
  const perProv = {};
  for (const ine in T.m) (perProv[ine.slice(0, 2)] = perProv[ine.slice(0, 2)] || []).push(ine);
  const piano = {};
  Object.keys(perProv).sort().forEach((p, i) => {
    const l = perProv[p], n = l.length, val = l.reduce((a, x) => a + T.m[x].validi, 0);
    const rk = new Map([...l].sort((a, b) => T.m[a].validi - T.m[b].validi).map((x, j) => [x, n > 1 ? j / (n - 1) : 0]));
    const ord = casuale ? [...l].sort((a, b) => rand(seme * 13 + +a) - rand(seme * 13 + +b))
      : [...l].sort((a, b) => (rk.get(a) * 0.6 + rand(seme * 7 + +a) * 0.4) - (rk.get(b) * 0.6 + rand(seme * 7 + +b) * 0.4));
    const grande = Math.log10(val) - 4.5;
    piano[p] = { ord, ritardo: 0.02 + rand(seme * 97 + i) * 0.12 + grande * 0.05, durata: 0.45 + grande * 0.18 + rand(seme * 31 + i) * 0.2 };
  });
  return piano;
}
function statoA(T, piano, f) {
  const live = {};
  for (const [p, x] of Object.entries(piano)) {
    const fr = f >= 1 ? 1 : Math.max(0, Math.min(1, (f - x.ritardo) / x.durata));
    const mesas = x.ord.reduce((a, ine) => a + T.m[ine].mesas, 0), obiettivo = fr * mesas;
    let esc = 0;
    for (const ine of x.ord) {
      if (esc >= obiettivo) break;
      const c = T.m[ine], k = Math.min(1, (obiettivo - esc) / c.mesas), v = {};
      for (const g in c.v) v[g] = Math.round(c.v[g] * k);
      live[ine] = { v, validi: Math.round(c.validi * k), mesas: c.mesas, esc: Math.max(1, Math.round(c.mesas * k)) };
      esc += c.mesas * k;
    }
  }
  return live;
}
function riparto(T, m) {
  const tot = {};
  for (const [ine, x] of Object.entries(m)) {
    const p = ine.slice(0, 2), t = tot[p] = tot[p] || { v: {}, validi: 0 };
    for (const g in x.v) t.v[g] = (t.v[g] || 0) + x.v[g]; t.validi += x.validi;
  }
  const s = {};
  for (const p in T.seggi) { if (!tot[p]) continue; const d = dhondt(tot[p].v, tot[p].validi, T.seggi[p]); for (const g in d) s[g] = (s[g] || 0) + d[g]; }
  return s;
}
const spostati = (a, b) => { const k = new Set([...Object.keys(a), ...Object.keys(b)]); let s = 0; for (const g of k) s += Math.abs((a[g] || 0) - (b[g] || 0)); return s / 2; };
const destra = s => Object.entries(s).reduce((a, [g, n]) => a + (famiglia(g) === 'PPF' || g === 'VOX' ? n : 0), 0);

const PUNTI = [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
function prova(nome, B, T, casuale, par) {
  const vero = riparto(T, T.m), righe = PUNTI.map(() => ({ n: 0, frac: 0, grezzo: 0, modello: 0, dGrezzo: 0, dModello: 0, cop: 0, copN: 0, maxModello: 0 }));
  for (let s = 1; s <= NOTTI; s++) {
    const piano = notte(T, s, casuale);
    /* il punto dello spoglio: si cerca l'istante in cui è contata la parte voluta dei seggi elettorali */
    const totMesas = Object.values(T.m).reduce((a, x) => a + x.mesas, 0);
    PUNTI.forEach((obiettivo, j) => {
      let lo = 0, hi = 1.6, live;
      for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; live = statoA(T, piano, mid); const esc = Object.values(live).reduce((a, x) => a + x.esc, 0); if (esc / totMesas < obiettivo) lo = mid; else hi = mid; }
      live = statoA(T, piano, hi);
      const grezzo = riparto(T, live);
      const R = proietta({ base: B.m, live, seggi: T.seggi, famiglia, par: { nSim: 200, ...par } });
      const r = righe[j]; r.n++; r.frac += R.frac;
      const sp = spostati(R.seggi, vero);
      r.grezzo += spostati(grezzo, vero); r.modello += sp; r.maxModello = Math.max(r.maxModello, sp);
      r.dGrezzo += Math.abs(destra(grezzo) - destra(vero)); r.dModello += Math.abs(destra(R.seggi) - destra(vero));
      for (const g of new Set([...Object.keys(vero), ...Object.keys(R.seggi)])) {
        const v = vero[g] || 0, [a, b] = R.int[g] || [0, 0];
        if (v === 0 && b === 0) continue;
        r.copN++; if (v >= a && v <= b) r.cop++;
      }
    });
  }
  console.log('\n' + nome + (casuale ? ' · ordine casuale' : ' · prima i comuni piccoli') + ` · ${NOTTI} notti`);
  console.log('contato  seggi spostati: grezzo  modello (peggiore)   PP+Vox, scarto medio: grezzo  modello   forchetta 80%');
  const out = righe.map((r, j) => ({ punto: PUNTI[j], frac: r.frac / r.n, grezzo: r.grezzo / r.n, modello: r.modello / r.n, peggiore: r.maxModello, destraGrezzo: r.dGrezzo / r.n, destraModello: r.dModello / r.n, copertura: r.cop / r.copN }));
  out.forEach(o => console.log(`${(o.frac * 100).toFixed(0).padStart(5)}%   ${o.grezzo.toFixed(1).padStart(14)} ${o.modello.toFixed(1).padStart(8)} ${('(' + o.peggiore + ')').padStart(10)}   ${o.destraGrezzo.toFixed(1).padStart(22)} ${o.destraModello.toFixed(1).padStart(8)}   ${(o.copertura * 100).toFixed(0).padStart(10)}%`));
  return out;
}

const C19a = carica(path.join(QUI, 'comuni201904.json'));
const C19n = carica(path.join(QUI, 'comuni201911.json'));
const C23 = carica(path.join(RADICE, 'dati', 'comuni2023.json'));
const par = process.env.PAR ? JSON.parse(process.env.PAR) : {};
const risultati = {
  quando: new Date().toISOString(), notti: NOTTI, par,
  'apr2019→nov2019': prova('Aprile 2019 → novembre 2019', C19a, C19n, false, par),
  'nov2019→lug2023': prova('Novembre 2019 → luglio 2023', C19n, C23, false, par),
  'nov2019→lug2023 casuale': prova('Novembre 2019 → luglio 2023', C19n, C23, true, par)
};
fs.writeFileSync(path.join(QUI, 'risultati.json'), JSON.stringify(risultati, null, 1));

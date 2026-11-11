/* Il backtest della proiezione dai sondaggi: le regole di proiezioneSondaggi() della pagina,
   applicate alla media dei sondaggi del 17 luglio 2023 (sondaggi2023.json) con la base di
   novembre 2019, comune per comune sommata per provincia, e i seggi del 2023.

   Differenze necessarie rispetto al 2026: nel 2023 Sumar si presentava anche nella Comunità
   Valenciana (con Compromís), e Podemos era dentro Sumar; nella tabella del 2023 UPN ha una
   colonna a sé, che qui si somma al PP come nei sondaggi del 2026.

   Uso:  node strumenti/backtest/sondaggi2023.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { famiglia, dhondt } from '../../proxy/lib/modello.js';

const QUI = path.dirname(fileURLToPath(import.meta.url)), RADICE = path.join(QUI, '..', '..');
const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
const i0 = html.indexOf('const GRUPPI = ['), i1 = html.indexOf('];', i0);
const GRUPPI = new Function('return ' + html.slice(i0 + 'const GRUPPI = '.length, i1 + 1))();
const gruppoDi = (sigla, nome) => { for (const s of [sigla, nome]) { const t = String(s || '').replace(/[–—]/g, '-'); const g = GRUPPI.find(x => x.re.test(t)); if (g) return g.k; } return 'L:' + String(sigla).toUpperCase(); };

/* la base: novembre 2019 per provincia, con le famiglie (Sumar = Unidas Podemos, Más País, Compromís…) */
const b19 = JSON.parse(fs.readFileSync(path.join(QUI, 'comuni201911.json'), 'utf8'));
const c23 = JSON.parse(fs.readFileSync(path.join(RADICE, 'dati', 'comuni2023.json'), 'utf8'));
const base = {};
for (const [ine, x] of Object.entries(b19.m)) {
  const p = ine.slice(0, 2), o = base[p] = base[p] || { g: {}, validi: 0 };
  o.validi += x[5];
  for (let i = 0; i < x[6].length; i += 2) {
    const g = gruppoDi(b19.partiti[x[6][i]][0], b19.partiti[x[6][i]][1]), f = famiglia(g);
    const k = f === 'SX' ? 'FA' : f === 'PPF' ? (g === 'PP' ? 'PP' : 'UPN') : g;
    o.g[k] = (o.g[k] || 0) + x[6][i + 1];
  }
}
const COD = Object.keys(base).sort(), V = COD.reduce((a, c) => a + base[c].validi, 0), gv = {};
COD.forEach(c => { for (const k in base[c].g) gv[k] = (gv[k] || 0) + base[c].g[k]; });
const seggi = Object.fromEntries(Object.entries(c23.prov).map(([p, x]) => [p, x[0]]));

/* le stesse regole della pagina */
const so = JSON.parse(fs.readFileSync(path.join(QUI, 'sondaggi2023.json'), 'utf8'));
/* con «veri» si danno al metodo le percentuali vere del 2023: si misura soltanto la traduzione
   da voti nazionali a seggi, senza l'errore dei sondaggi */
const VERI = process.argv[2] === 'veri';
let m;
if (VERI) {
  const t = {}; let tv = 0;
  for (const x of Object.values(c23.m)) { tv += x[5]; for (let i = 0; i < x[6].length; i += 2) { const g = gruppoDi(c23.partiti[x[6][i]][0], c23.partiti[x[6][i]][1]); t[g] = (t[g] || 0) + x[6][i + 1]; } }
  m = {}; ['PP', 'PSOE', 'VOX', 'FA', 'ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC'].forEach(k => { m[k] = (t[k] || 0) / tv * 100; });
  m.PP += (t.UPN || 0) / tv * 100;
} else { m = { ...so.media, PP: so.media.PP + (so.media.UPN || 0) }; delete m.UPN; delete m.CUP; delete m.EV; }
function baseSondaggi() {
  const out = {}; COD.forEach(c => { out[c] = {}; });
  const ppUpn = (gv.PP || 0) + (gv.UPN || 0);
  COD.forEach(c => {
    const g = base[c].g, o = out[c];
    const r = m.PP / 100 * V / ppUpn; if (g.PP) o.PP = g.PP * r; if (g.UPN) o.UPN = g.UPN * r;
    ['PSOE', 'VOX', 'ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC'].forEach(k => { if (m[k] && g[k] && gv[k]) o[k] = g[k] * m[k] / 100 * V / gv[k]; });
  });
  const tot = COD.reduce((s, c) => s + (base[c].g.FA || 0), 0);
  COD.forEach(c => { out[c].FA = m.FA / 100 * V * (base[c].g.FA || 0) / tot; });   /* Sumar in tutte le province */
  return out;
}
function rng(seme) { return () => { seme |= 0; seme = seme + 0x6D2B79F5 | 0; let t = Math.imul(seme ^ seme >>> 15, 1 | seme); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function seggiDa(b, fn) {
  const s = {};
  for (const c of COD) {
    const val = base[c].validi;
    let l = Object.entries(b[c]).map(([k, v]) => [k, fn ? fn(k, v) : v]);
    const t = l.reduce((a, x) => a + x[1], 0); if (t > val * 0.98) l = l.map(([k, v]) => [k, v * val * 0.98 / t]);
    const d = dhondt(Object.fromEntries(l), val, seggi[c]);
    for (const k in d) s[k] = (s[k] || 0) + d[k];
  }
  return s;
}
const B = baseSondaggi(), centro = seggiDa(B), r = rng(29112026), sim = {}, D = [];
const ks = Object.keys(m), dx = ['PP', 'VOX'], sx = ['PSOE', 'FA'];
const tdx = dx.reduce((a, k) => a + m[k], 0), tsx = sx.reduce((a, k) => a + m[k], 0);
for (let i = 0; i < 1000; i++) {
  const z = gauss(r) * 2, f = {};
  ks.forEach(k => { const com = dx.includes(k) ? z * m[k] / tdx : sx.includes(k) ? -z * m[k] / tsx : 0; f[k] = Math.max(0, m[k] + com + gauss(r) * (0.3 + 0.08 * m[k])) / m[k]; });
  f.UPN = f.PP;
  const s = seggiDa(B, (k, v) => v * (f[k] != null ? f[k] : 1) * Math.exp(gauss(r) * 0.08));
  for (const k in s) (sim[k] = sim[k] || []).push(s[k]);
  D.push((s.PP || 0) + (s.VOX || 0) + (s.UPN || 0));
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); while (s.length < 1000) s.unshift(0); return s[Math.floor(p * s.length)]; };
const VERO = { PP: 137, PSOE: 121, VOX: 33, FA: 31, ERC: 7, JUNTS: 7, BILDU: 6, PNV: 5, BNG: 1, CC: 1, UPN: 1 };
console.log(VERI ? 'Proiezione delle percentuali vere del 2023, base novembre 2019' : 'Proiezione della media dei sondaggi del 17 luglio 2023, base novembre 2019');
console.log('partito   proiezione  forchetta 80%   istituti   risultato');
let dentro = 0, tot = 0, sp = 0;
for (const k of Object.keys(VERO)) {
  const a = sim[k] || [0], i = [q(a, 0.1), q(a, 0.9)], ok = VERO[k] >= i[0] && VERO[k] <= i[1];
  tot++; if (ok) dentro++; sp += Math.abs((centro[k] || 0) - VERO[k]);
  console.log(`${k.padEnd(8)} ${String(centro[k] || 0).padStart(8)}   ${(i[0] + '–' + i[1]).padStart(12)}   ${String(so.seggiIstituti[k] ?? '—').padStart(8)}   ${String(VERO[k]).padStart(6)} ${ok ? '' : '  fuori'}`);
}
const d = (centro.PP || 0) + (centro.VOX || 0) + (centro.UPN || 0);
console.log(`PP+Vox+UPN: proiezione ${d} (${q(D, 0.1)}–${q(D, 0.9)}), maggioranza in ${Math.round(D.filter(x => x >= 176).length / 10)} simulazioni su 100; risultato 171`);
console.log(`seggi spostati rispetto al risultato: ${sp / 2}; dentro la forchetta ${dentro} partiti su ${tot}`);
fs.writeFileSync(path.join(QUI, VERI ? 'sondaggi2023-veri.json' : 'sondaggi2023-risultato.json'), JSON.stringify({ centro, int: Object.fromEntries(Object.keys(sim).map(k => [k, [q(sim[k], 0.1), q(sim[k], 0.9)]])), destra: { centro: d, int: [q(D, 0.1), q(D, 0.9)], pMagg: D.filter(x => x >= 176).length / 1000 }, vero: VERO }, null, 1));

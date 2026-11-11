/* La proiezione dello spoglio: come finirà il conteggio, dai comuni già contati.

   Lo usano la pagina (con i comuni di stanotte o quelli della prova generale) e il backtest
   (strumenti/backtest/backtest.mjs). È un modulo ES senza dipendenze.

   Il problema: in Spagna arrivano prima i comuni piccoli, più a destra della media, e le grandi
   città per ultime. Il voto contato a metà spoglio non rappresenta il paese.

   Il metodo: ogni comune contato si confronta con se stesso all'elezione precedente.
   - I partiti si riuniscono in famiglie che esistono in tutte e due le elezioni (Sumar 2023 è la
     famiglia di Frente Amplio, Podemos, Front Valencià e Adelante Andalucía; PP e UPN stanno
     insieme; ogni altro partito è la sua famiglia; le liste minori sono «altri»; le schede bianche
     sono una famiglia a sé).
   - Per ogni famiglia si misura il rapporto fra i voti presi e quelli che avrebbe preso con le
     quote della volta precedente, nella stessa provincia e nella stessa classe di dimensione
     dei comuni. Dove i comuni contati sono pochi, la stima si avvicina a quella della provincia
     intera e poi a quella nazionale della stessa classe (pesi in voti: K).
   - Una famiglia che la volta precedente non c'era o quasi (SALF) prende la quota osservata nei
     comuni contati della stessa provincia e classe.
   - Ogni comune non contato vota come la volta precedente corretto da quei rapporti, con
     l'affluenza stimata allo stesso modo; un comune contato in parte vota, nella parte che manca,
     come nella parte contata.
   - Dentro una famiglia i voti si dividono fra i partiti come nei comuni contati della provincia.
   - Poi il D'Hondt in ogni circoscrizione.
   L'incertezza: simulazioni con un errore per famiglia comune a tutto il paese e uno per
   provincia, sulla parte non ancora contata, più largo dove si è contato poco. Le ampiezze
   sono tarate sul backtest.

   Ingressi (già raggruppati per partito):
     base:  { ine: { v: { partito: voti }, validi, mesas } }           l'elezione precedente
     live:  { ine: { v: { partito: voti }, validi, mesas, esc } }       i comuni contati (esc > 0)
     seggi: { '28': 38, … }
     famiglia: partito -> famiglia ('_B' sono le schede bianche, già dentro validi) */

/* Le famiglie. Le chiavi sono quelle dei partiti della pagina (GRUPPI); le liste minori hanno
   chiavi «L:SIGLA». Sumar nel 2023 e Unidas Podemos, Más País e Compromís nel 2019 sono la
   stessa famiglia dei loro eredi; Navarra Suma (2019) sta con PP e UPN; Ciudadanos a sé. */
export function famiglia(g) {
  if (g === '_B') return '_B';
  if (g === 'PP' || g === 'UPN' || /^L:NA\+/.test(g)) return 'PPF';
  if (g === 'FA' || g === 'PODEMOS' || g === 'FV' || g === 'AA') return 'SX';
  if (/^L:(CS|C'S|CIUDADANOS)\b/.test(g)) return 'CS';
  if (g === 'NC') return 'CC';
  if (g.startsWith('L:')) return 'ALTRI';
  return g;
}

export const PAR = {
  K: 4000,            /* voti di peso della stima di livello superiore */
  KT: 20000,          /* lo stesso per l'affluenza */
  /* gli errori, in scala logaritmica, sulla parte non ancora contata: un minimo più una parte
     che si riduce man mano che si conta (con KN voti contati nel paese, o KP nella provincia,
     è ridotta di un terzo circa) */
  sdNazMin: 0.01, sdNazInizio: 0.15, KN: 300000,
  sdProvMin: 0.01, sdProvInizio: 0.12, KP: 20000,
  sdAdd: 0.25,        /* errore relativo delle famiglie senza base */
  nSim: 400
};

const CLASSI = [500, 2000, 10000, 50000];
const classe = v => { let i = 0; while (i < CLASSI.length && v >= CLASSI[i]) i++; return i; };

export function dhondt(voti, validi, seggi, soglia = 0.03) {
  const min = soglia * validi, q = [];
  for (const [k, v] of Object.entries(voti)) if (k !== '_B' && v > 0 && v >= min) for (let d = 1; d <= seggi; d++) q.push([k, v / d, v]);
  q.sort((a, b) => b[1] - a[1] || b[2] - a[2]);
  const out = {};
  for (let i = 0; i < seggi && i < q.length; i++) out[q[i][0]] = (out[q[i][0]] || 0) + 1;
  return out;
}

/* le bianche: i voti validi meno quelli delle liste */
function conBianche(v, validi) {
  let s = 0; for (const k in v) if (k !== '_B') s += v[k];
  return { ...v, _B: Math.max(0, validi - s) };
}
function perFamiglia(v, famiglia) {
  const f = {}; for (const k in v) { const x = famiglia(k); f[x] = (f[x] || 0) + v[k]; } return f;
}
function rng(seme) { return () => { seme |= 0; seme = seme + 0x6D2B79F5 | 0; let t = Math.imul(seme ^ seme >>> 15, 1 | seme); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

export function proietta({ base, live, seggi, famiglia, par = {} }) {
  const P = { ...PAR, ...par };
  /* 1 · le somme dei comuni contati: osservato e atteso con le quote precedenti, per famiglia */
  const acc = new Map();   /* chiave -> { o: {f}, e: {f}, vo, ve, n } */
  const tieni = (key, fo, fe, vo, ve) => {
    let a = acc.get(key); if (!a) { a = { o: {}, e: {}, vo: 0, ve: 0 }; acc.set(key, a); }
    for (const f in fo) a.o[f] = (a.o[f] || 0) + fo[f];
    for (const f in fe) a.e[f] = (a.e[f] || 0) + fe[f];
    a.vo += vo; a.ve += ve;
  };
  const gruppiProv = {}, gruppiNaz = {};   /* i voti per partito contati, per dividere le famiglie */
  const famB = {}, info = {};
  for (const [ine, b] of Object.entries(base)) {
    const fb = perFamiglia(conBianche(b.v, b.validi), famiglia);
    famB[ine] = fb;
    info[ine] = { p: ine.slice(0, 2), s: classe(b.validi) };
  }
  for (const [ine, l] of Object.entries(live)) {
    const b = base[ine]; if (!b || !l.esc || !l.validi) continue;
    const k = Math.min(1, l.esc / (l.mesas || b.mesas || 1)), { p, s } = info[ine];
    const vl = conBianche(l.v, l.validi), fo = perFamiglia(vl, famiglia), fe = {};
    for (const f in famB[ine]) fe[f] = famB[ine][f] / b.validi * l.validi;
    for (const key of [p + '|' + s, p, 'N|' + s, 'N']) tieni(key, fo, fe, l.validi, b.validi * k);
    const gp = gruppiProv[p] = gruppiProv[p] || {};
    for (const g in vl) { gp[g] = (gp[g] || 0) + vl[g]; gruppiNaz[g] = (gruppiNaz[g] || 0) + vl[g]; }
  }
  const tutte = new Set(); for (const ine in famB) for (const f in famB[ine]) tutte.add(f);
  for (const a of acc.values()) for (const f in a.o) tutte.add(f);
  /* 2 · i rapporti, dal livello più largo al più stretto */
  const vuoto = { o: {}, e: {}, vo: 0, ve: 0 };
  const A = key => acc.get(key) || vuoto;
  const rapporto = (a, f, prior, K) => { const o = a.o[f] || 0, e = a.e[f] || 0; return (o + K * prior) / (e + K); };
  const quota = (a, f, prior, K) => ((a.o[f] || 0) + K * prior) / (a.vo + K);
  const nazR = {}, nazQ = {};
  for (const f of tutte) {
    const N = A('N'); nazR[f] = rapporto(N, f, 1, P.K); nazQ[f] = quota(N, f, 0, P.K);
  }
  const nazT = (A('N').vo + P.KT) / (A('N').ve + P.KT);
  /* per le famiglie nuove: in quante delle province già contate si presentano. Un partito
     regionale nuovo non deve comparire, per ipotesi, nelle province dove non corre. */
  const provContate = Object.keys(seggi).filter(p => A(p).vo > 0);
  const presenza = {};
  for (const f of tutte) presenza[f] = provContate.length ? provContate.filter(p => (A(p).o[f] || 0) > 0).length / provContate.length : 1;
  const stima = {};   /* p|s -> { r: {f}, q: {f}, t, nuove: Set } */
  const stimaDi = (p, s) => {
    const key = p + '|' + s; if (stima[key]) return stima[key];
    const Ns = A('N|' + s), Pp = A(p), Ps = A(key), r = {}, q = {};
    for (const f of tutte) {
      const rNs = rapporto(Ns, f, nazR[f], P.K), rP = rapporto(Pp, f, nazR[f], P.K);
      r[f] = rapporto(Ps, f, rP * rNs / nazR[f], P.K);
      const qNs = quota(Ns, f, nazQ[f], P.K), qP = quota(Pp, f, qNs * presenza[f], P.K);
      q[f] = quota(Ps, f, qP, P.K);
    }
    const tNs = (Ns.vo + P.KT * nazT) / (Ns.ve + P.KT), tP = (Pp.vo + P.KT * tNs) / (Pp.ve + P.KT);
    const t = (Ps.vo + P.KT * tP) / (Ps.ve + P.KT);
    return stima[key] = { r, q, t };
  };
  /* le famiglie «nuove» in una provincia: meno dello 0,5% la volta precedente */
  const baseProv = {};
  for (const ine in famB) { const p = info[ine].p, bp = baseProv[p] = baseProv[p] || { tot: 0 }; for (const f in famB[ine]) { bp[f] = (bp[f] || 0) + famB[ine][f]; bp.tot += famB[ine][f]; } }
  const nuova = (p, f) => !baseProv[p] || (baseProv[p][f] || 0) < 0.005 * baseProv[p].tot;
  /* 3 · i voti che mancano, comune per comune, sommati per provincia e famiglia */
  const contati = {}, mancano = {}, contProv = {};
  for (const p in seggi) { contati[p] = {}; mancano[p] = {}; contProv[p] = { vo: 0, mesas: 0, esc: 0 }; }
  for (const [ine, b] of Object.entries(base)) {
    const { p, s } = info[ine]; if (!mancano[p]) continue;
    const l = live[ine], k = l && l.esc ? Math.min(1, l.esc / (l.mesas || b.mesas || 1)) : 0;
    contProv[p].mesas += b.mesas || 0; contProv[p].esc += (b.mesas || 0) * k;
    if (k > 0) {
      const vl = conBianche(l.v, l.validi);
      for (const g in vl) contati[p][g] = (contati[p][g] || 0) + vl[g];
      contProv[p].vo += l.validi;
      if (k < 1) {   /* la parte che manca vota come la parte contata */
        const fo = perFamiglia(vl, famiglia), resto = (1 - k) / k;
        for (const f in fo) mancano[p][f] = (mancano[p][f] || 0) + fo[f] * resto;
      }
      continue;
    }
    const E = stimaDi(p, s), validi = b.validi * E.t, sh = {};
    let tot = 0;
    for (const f of tutte) {
      const x = nuova(p, f) ? E.q[f] : (famB[ine][f] || 0) / b.validi * E.r[f];
      if (x > 0) { sh[f] = x; tot += x; }
    }
    for (const f in sh) mancano[p][f] = (mancano[p][f] || 0) + sh[f] / tot * validi;
  }
  /* 4 · dalle famiglie ai partiti, come nei comuni contati della provincia (o del paese) */
  const membri = {};
  const dividi = (p, f, v) => {
    const fonte = Object.keys(gruppiProv[p] || {}).some(g => famiglia(g) === f) ? gruppiProv[p] : gruppiNaz;
    const gs = Object.entries(fonte).filter(([g]) => famiglia(g) === f);
    const t = gs.reduce((a, [, x]) => a + x, 0);
    if (!t) return { [f]: v };
    const o = {}; for (const [g, x] of gs) o[g] = v * x / t; return o;
  };
  const quote = {};
  for (const p in mancano) { quote[p] = {}; for (const f in mancano[p]) quote[p][f] = dividi(p, f, 1); }
  const totali = (fattore) => {
    const out = {};
    for (const p in seggi) {
      const v = { ...contati[p] };
      for (const f in mancano[p]) {
        const m = mancano[p][f] * (fattore ? fattore(p, f) : 1);
        for (const g in quote[p][f]) v[g] = (v[g] || 0) + m * quote[p][f][g];
      }
      out[p] = v;
    }
    return out;
  };
  const seggiDa = vp => {
    const s = {}, sp = {};
    for (const p in seggi) {
      const v = vp[p], validi = Object.values(v).reduce((a, x) => a + x, 0);
      const d = dhondt(v, validi, seggi[p]); sp[p] = d;
      for (const g in d) s[g] = (s[g] || 0) + d[g];
    }
    return { s, sp };
  };
  const centro = totali(), C = seggiDa(centro);
  /* 5 · le simulazioni */
  const r = rng(29112026), campioni = [];
  const fam = [...tutte], voN = A('N').vo;
  const sdN = P.sdNazMin + P.sdNazInizio * Math.sqrt(P.KN / (voN + P.KN));
  for (let i = 0; i < P.nSim; i++) {
    const en = {}; for (const f of fam) en[f] = gauss(r) * sdN;
    const ep = {};
    const fattore = (p, f) => {
      const key = p + '|' + f;
      if (ep[key] == null) {
        const sd = nuova(p, f) ? P.sdAdd : P.sdProvMin + P.sdProvInizio * Math.sqrt(P.KP / (contProv[p].vo + P.KP));
        ep[key] = Math.exp(en[f] + gauss(r) * sd);
      }
      return ep[key];
    };
    campioni.push(seggiDa(totali(fattore)).s);
  }
  const gruppi = new Set(); campioni.forEach(c => Object.keys(c).forEach(g => gruppi.add(g))); Object.keys(C.s).forEach(g => gruppi.add(g));
  const int = {};
  for (const g of gruppi) {
    const a = campioni.map(c => c[g] || 0).sort((x, y) => x - y);
    int[g] = [a[Math.floor(0.1 * a.length)], a[Math.min(a.length - 1, Math.floor(0.9 * a.length))]];
  }
  /* il voto nazionale proiettato, per partito */
  const voti = {}; let validi = 0;
  for (const p in centro) for (const g in centro[p]) { voti[g] = (voti[g] || 0) + centro[p][g]; validi += centro[p][g]; }
  const esc = Object.values(contProv).reduce((a, x) => a + x.esc, 0), mesas = Object.values(contProv).reduce((a, x) => a + x.mesas, 0);
  return { seggi: C.s, perProv: C.sp, int, campioni, voti, validi, frac: mesas ? esc / mesas : 0, perVoti: centro };
}

/* Proxy dei risultati provvisori del Ministero dell'Interno spagnolo (Congresso).

   GET /api/mir              la Spagna e le 52 circoscrizioni, in un riassunto compatto
   GET /api/mir?comuni=28    i comuni di una provincia (28 = Madrid), nello schema di dati/comuni2023.json
   GET /api/mir?comuni=tutti i comuni di tutte le province, per la mappa e per la proiezione dello spoglio
   GET /api/mir?senato=1     il Senato: le 47 province, le isole, Ceuta e Melilla, con i senatori per candidatura
   GET /api/mir?grezzo=28    un ambito così come lo pubblica il Ministero (28 = Madrid, 1 = Spagna)
   GET /api/mir?diag=1       diagnostica: raggiungibilità, stato HTTP, latenza, anti-bot, regione

   Il sito dei risultati del 2026 non è ancora pubblicato (30 ottobre). Il proxy segue il
   formato del 2023, «backend-difu», descritto in lib/normalizza.js. Se il Ministero cambia
   indirizzo o percorso basta una variabile d'ambiente su Vercel, senza toccare il codice:
     MIR_BASE   indirizzo del sito dei risultati, con la barra finale
                (predefinito https://resultados.29neleccionesgenerales.es/, da verificare)
     MIR_RUTA   percorso di un ambito, con {id} al posto dello scopeId
                (predefinito backend-difu/scope/data/getScopeData/{id}/1/2/1/0)
     MIR_MAPA   percorso della Spagna con le province dentro, una richiesta sola
                (predefinito backend-difu/scope/data/getScopeData/{id}/1/2/1/1/30)
     MIR_COMUNI percorso di una provincia con i comuni dentro
                (predefinito backend-difu/scope/data/getScopeData/{id}/1/2/1/1/90: nel 2023 il
                sito mostrava così la mappa dei comuni di una provincia, da verificare)
     MIR_SENATO percorso della Spagna con le province dentro, per il Senato (elezione 3)
                (predefinito backend-difu/scope/data/getScopeData/{id}/2/3/1/1/30: nel 2023 il
                sito chiedeva il Senato con «2/3» al posto di «1/2», da verificare)
     MIR_SENATO_ISOLE lo stesso per una provincia con le sue isole (livello 70)
                (predefinito backend-difu/scope/data/getScopeData/{id}/2/3/1/1/70)

   Una lettura prova prima MIR_MAPA (una richiesta). Se la risposta non contiene le 52
   province, chiede le province una per una, 6 alla volta. La cache del CDN di Vercel
   (s-maxage=20) fa sì che molti lettori aperti generino al massimo un giro ogni 20 secondi.
   I comuni si chiedono tutti insieme (?comuni=tutti), dopo i primi voti contati: servono alla
   mappa dei comuni e alla proiezione dello spoglio. La risposta resta in cache 90 secondi:
   al massimo 52 richieste al Ministero ogni 90 secondi, comunque vada il traffico. */

import { scopeId, PROVINCE, riassumi, valido, comuni, senato } from '../lib/normalizza.js';

const BASE = process.env.MIR_BASE || 'https://resultados.29neleccionesgenerales.es/';
const RUTA = process.env.MIR_RUTA || 'backend-difu/scope/data/getScopeData/{id}/1/2/1/0';
const MAPA = process.env.MIR_MAPA || 'backend-difu/scope/data/getScopeData/{id}/1/2/1/1/30';
const COMUNI = process.env.MIR_COMUNI || 'backend-difu/scope/data/getScopeData/{id}/1/2/1/1/90';
const SENATO = process.env.MIR_SENATO || 'backend-difu/scope/data/getScopeData/{id}/2/3/1/1/30';
const SENATO_ISOLE = process.env.MIR_SENATO_ISOLE || 'backend-difu/scope/data/getScopeData/{id}/2/3/1/1/70';
const PROV_ISOLE = ['07', '35', '38'];
const ESPANA = scopeId(1, 1);

/* Origini ammesse. Aggiungi qui il dominio se la pagina va anche altrove. */
const ORIGINI = [
  'https://angrisanidj.github.io',
  'http://localhost', 'http://127.0.0.1', 'null'
];
const originOk = o => ORIGINI.some(a => o === a || o.startsWith(a + ':'));

/* Solo parametri conosciuti: ogni variante dell'indirizzo è una voce di cache a sé. */
const PARAMETRI = { diag: v => v === '1', grezzo: v => v === '1' || PROVINCE.includes(v), comuni: v => v === 'tutti' || PROVINCE.includes(v), senato: v => v === '1' };
const limitato = s => s === 429 || s === 403;
/* Dopo un 429 o un 403, per un minuto questa istanza non chiede niente al Ministero. */
const FRENO_MS = 60000;
let frenoFino = 0;

function cors(req, res) {
  const o = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', originOk(o) ? o : ORIGINI[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'X-Mir-Fetched, X-Mir-Modo');
}

const url = (percorso, id) => BASE + percorso.replace('{id}', id);

async function scarica(u, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(u, {
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9,it;q=0.8',
        'Referer': BASE,
        'Cache-Control': 'no-cache'
      }
    });
  } finally { clearTimeout(t); }
}

/* Un file JSON del Ministero, o un errore con lo stato HTTP. */
async function json(u) {
  const r = await scarica(u);
  if (limitato(r.status)) frenoFino = Date.now() + FRENO_MS;
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.stato = r.status; throw e; }
  const t = await r.text();
  try { return JSON.parse(t); } catch (_) {
    const e = new Error('risposta non JSON (' + t.slice(0, 60).replace(/\s+/g, ' ') + ')'); e.stato = r.status; throw e;
  }
}

async function aGruppi(lista, k, fn) {
  const out = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: k }, async () => {
    while (i < lista.length) { const j = i++; out[j] = await fn(lista[j]).catch(e => ({ errore: e })); }
  }));
  return out;
}

async function leggiTutto() {
  /* prima la Spagna con le province dentro, in una richiesta */
  let naz = null, modo = 'mapa';
  try {
    naz = await json(url(MAPA, ESPANA));
    const R = riassumi([naz]);
    if (Object.keys(R.circ).length === 52) return { R, modo, errori: 0 };
  } catch (e) { if (limitato(e.stato)) throw e; }
  /* altrimenti la Spagna e le 52 province una per una */
  modo = 'province';
  const ris = await aGruppi(['1', ...PROVINCE], 6, c => json(url(RUTA, c === '1' ? ESPANA : scopeId(c, 30))));
  const errori = ris.filter(r => r && r.errore);
  const lim = errori.find(r => limitato(r.errore.stato));
  if (lim) throw lim.errore;
  const R = riassumi(ris.filter(r => r && !r.errore).concat(naz ? [naz] : []));
  if (!valido(R)) { const e = errori[0] ? errori[0].errore : new Error('nessun ambito leggibile'); throw e; }
  return { R, modo, errori: errori.length };
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originOk(req.headers.origin || 'null')) return res.status(403).json({ errore: 'origine non ammessa' });
  const q = req.query || {};
  for (const [k, v] of Object.entries(q)) {
    if (!PARAMETRI[k] || !PARAMETRI[k](String(v))) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
      return res.status(400).json({ errore: 'parametro sconosciuto: ' + k });
    }
  }

  if (q.diag) {
    const out = { regione: process.env.VERCEL_REGION || 'sconosciuta', quando: new Date().toISOString(), base: BASE, prove: [] };
    for (const [nome, u] of [['spagna+province', url(MAPA, ESPANA)], ['spagna', url(RUTA, ESPANA)], ['madrid', url(RUTA, scopeId(28, 30))], ['soria+comuni', url(COMUNI, scopeId(42, 30))]]) {
      const t0 = Date.now();
      try {
        const r = await scarica(u, 10000);
        const t = await r.text();
        let riassunto = null;
        try { const j = JSON.parse(t), R = riassumi([j]); riassunto = { province: Object.keys(R.circ).length, comuni: Object.keys(comuni(j).m).length, naz: R.naz && { esc: R.naz.esc, mesas: R.naz.mesas, validi: R.naz.validi }, quando: R.quando }; } catch (_) { }
        out.prove.push({ nome, url: u, stato: r.status, ms: Date.now() - t0, tipo: r.headers.get('content-type'),
          server: r.headers.get('server'), via: r.headers.get('via'), waf: r.headers.get('x-amzn-waf-action'),
          cache: r.headers.get('x-cache'), byte: t.length, riassunto, inizio: riassunto ? undefined : t.slice(0, 200) });
      } catch (e) { out.prove.push({ nome, url: u, errore: String(e && e.message || e), ms: Date.now() - t0 }); }
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  }

  if (Date.now() < frenoFino) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    return res.status(503).json({ errore: 'Il Ministero ha limitato le richieste: pausa di un minuto' });
  }

  if (q.senato) {
    /* la Spagna con le province, poi le tre province con le isole: quattro richieste */
    const ris = await aGruppi([['1', SENATO], ...PROV_ISOLE.map(c => [c, SENATO_ISOLE])], 4, ([c, ruta]) => json(url(ruta, c === '1' ? ESPANA : scopeId(c, 30))));
    const ok = ris.filter(r => r && !r.errore);
    const lim = ris.find(r => r && r.errore && limitato(r.errore.stato));
    if (!ok.length) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=' + (lim ? 300 : 30));
      const e = ris.find(r => r && r.errore);
      return res.status(502).json({ errore: 'Senato non disponibile: ' + (e ? e.errore.message : 'nessuna risposta'), stato: e && e.errore.stato || 0 });
    }
    const S = senato(ok);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ ...S, mancanti: ris.length - ok.length });
  }

  if (q.comuni === 'tutti') {
    /* le 52 province, 6 alla volta; una provincia che non risponde resta fuori da questo giro */
    const ris = await aGruppi(PROVINCE, 6, c => json(url(COMUNI, scopeId(c, 30))).then(comuni));
    const prov = {}; let quando = null, errori = 0, lim = false;
    ris.forEach((C, i) => {
      if (!C || C.errore) { errori++; if (C && C.errore && limitato(C.errore.stato)) lim = true; return; }
      if (!Object.keys(C.m).length) { errori++; return; }
      prov[PROVINCE[i]] = { m: C.m, partiti: C.partiti };
      if (C.quando && (!quando || C.quando > quando)) quando = C.quando;
    });
    if (!Object.keys(prov).length) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=' + (lim ? 300 : 30));
      const e = ris.find(x => x && x.errore);
      return res.status(502).json({ errore: 'Comuni non disponibili: ' + (e ? e.errore.message : 'nessun comune nelle risposte'), stato: e && e.errore.stato || 0 });
    }
    res.setHeader('X-Mir-Modo', 'comuni ' + Object.keys(prov).length + '/52');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=90, stale-while-revalidate=120');
    return res.status(200).json({ quando, prov, mancanti: errori });
  }

  if (q.comuni) {
    try {
      const C = comuni(await json(url(COMUNI, scopeId(String(q.comuni), 30))));
      if (!Object.keys(C.m).length) throw Object.assign(new Error('nessun comune nella risposta'), { stato: 200 });
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=90, stale-while-revalidate=120');
      return res.status(200).json(C);
    } catch (e) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=' + (limitato(e.stato) ? 300 : 30));
      return res.status(502).json({ errore: 'Comuni non disponibili: ' + e.message, stato: e.stato || 0 });
    }
  }

  if (q.grezzo) {
    const c = String(q.grezzo);
    try {
      const j = await json(url(RUTA, c === '1' ? ESPANA : scopeId(c, 30)));
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');
      return res.status(200).json(j);
    } catch (e) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=' + (limitato(e.stato) ? 300 : 10));
      return res.status(502).json({ errore: 'Il Ministero ha risposto: ' + e.message, stato: e.stato || 0 });
    }
  }

  try {
    const { R, modo, errori } = await leggiTutto();
    res.setHeader('X-Mir-Fetched', new Date().toISOString());
    res.setHeader('X-Mir-Modo', modo + (errori ? ' (' + errori + ' ambiti mancanti)' : ''));
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');
    return res.status(200).json(R);
  } catch (e) {
    const s = e && e.stato || 0;
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=' + (limitato(s) ? 300 : 10));
    return res.status(502).json({ errore: s === 404 ? 'Il sito dei risultati non pubblica ancora i dati (404)' : 'Il Ministero non risponde: ' + (e && e.message || e), stato: s });
  }
}

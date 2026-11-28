/* Dal formato del Ministero dell'Interno al riassunto compatto che legge la pagina.

   Lo usano il proxy (proxy/api/mir.js) e la pagina stessa, quando la redazione importa a mano
   i file scaricati dal sito dei risultati. È un modulo ES senza dipendenze.

   Il formato è quello del sito dei risultati del 2023 (resultados.generales23j.es), costruito
   sul «backend-difu»: un file JSON per ambito, che si chiede con il suo scopeId.
     GET <base>backend-difu/scope/data/getScopeData/<scopeId>/1/2/1/0         un ambito
     GET <base>backend-difu/scope/data/getScopeData/<scopeId>/1/2/1/1/30      con le province in «mapa»
   L'ambito è { codigo, nombre, nivel, numMesas, censoINE, censoNoche, escrutinio, ... } e
   escrutinio = { fecha, mesasEscrutadas, votosValidos, votosBlancos, votosNulos, votosTotales,
   partidos: [{ siglas, codigo, nombre, votos, cargos, agrupaciones: [{ nivel: 1, siglas }] }] }.
   Ogni numero è una coppia { pro, def }: nel 2023, la sera del voto, erano uguali. Si legge pro,
   e def se pro manca. Livelli: 1 Spagna, 20 comunità, 30 provincia (= circoscrizione), 90 comune.

   Lo scopeId è il codice seguito dal livello, letto come numero decimale e scritto in
   esadecimale su 24 cifre: la Spagna («1» e 1 → 11) è 00…0b, Madrid («28» e 30 → 2830) è
   00…b0e, l'Andalusia («01» e 20 → 120) è 00…78. Verificato sul nomenclatore del 2023.

   Il riassunto:
   { quando, naz: AMBITO, circ: { '28': AMBITO, ... }, partiti: { codice: [sigla, nome, sigla nazionale] } }
   AMBITO = { n, mesas, esc, censo, votanti, nulle, bianche, validi, pctEsc, v: { codice: [voti, seggi] } }

   Il sito del 2026 (resultados.29neleccionesgenerales.com, aperto il 28/11) ha lo stesso schema,
   con tre differenze verificate quel giorno: le candidature hanno solo il codice, e sigla e nome
   si prendono dal catalogo in candidature.js; anche la data («fecha») è una coppia { pro, def };
   i candidati del Senato stanno in escrutinio.candidaturas, con partido.codigo e cargo. */

import { CANDIDATURE } from './candidature.js';

export const scopeId = (codigo, livello) => Number(String(codigo) + livello).toString(16).padStart(24, '0');
export const PROVINCE = Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, '0'));

const n = x => {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  if (typeof x === 'object') return n(x.pro != null && (x.pro || x.def == null) ? x.pro : x.def);
  const v = Number(String(x).replace(',', '.'));
  return isFinite(v) ? v : 0;
};

/* La data di un ambito: una stringa ISO, o la coppia { pro, def } del 2026. */
const data = f => (f && typeof f === 'object' ? f.pro || f.def : f) || null;

/* Sigla, nome e sigla nazionale di una candidatura: dal dato, se li porta (2023), o dal catalogo. */
function voce(p, cat) {
  const cod = String(p.codigo), ag = (p.agrupaciones || []).find(a => a && a.nivel === 1), c = cat[cod];
  if (p.siglas || !c) return [p.siglas || cod, p.nombre || '', ag && ag.siglas ? ag.siglas : ''];
  return [c[0], c[1], c[2]];
}

/* Un ambito del Ministero, nel formato compatto. partiti raccoglie i nomi una volta sola. */
export function ambito(s, partiti, cat = CANDIDATURE.c) {
  const e = s && s.escrutinio;
  const out = {
    n: s.nombre || '', mesas: n(s.numMesas), censo: n(s.censoNoche) || n(s.censoINE),
    esc: 0, votanti: 0, nulle: 0, bianche: 0, validi: 0, pctEsc: 0, v: {}, quando: null
  };
  if (!e) return out;
  out.esc = n(e.mesasEscrutadas);
  out.pctEsc = n(e.porcMesasEscrutadas);
  out.votanti = n(e.votosTotales);
  out.nulle = n(e.votosNulos);
  out.bianche = n(e.votosBlancos);
  out.validi = n(e.votosValidos);
  out.censoEsc = n(e.censoNocheEscrutado) || n(e.censoEscrutado);
  out.quando = data(e.fecha);
  for (const p of e.partidos || []) {
    const cod = String(p.codigo);
    if (!partiti[cod]) partiti[cod] = voce(p, cat);
    const v = n(p.votos), seggi = n(p.cargos);
    if (v || seggi) out.v[cod] = [v, seggi];
  }
  return out;
}

/* Da una o più risposte del Ministero (l'ambito nazionale, con o senza le province in «mapa»,
   e gli ambiti provinciali) al riassunto. Gli ambiti si riconoscono dal livello. */
export function riassumi(risposte) {
  const partiti = {}, circ = {};
  let naz = null;
  const visita = s => {
    if (!s || typeof s !== 'object') return;
    const liv = Number(s.nivel);
    if (liv === 1) naz = ambito(s, partiti);
    else if (liv === 30) circ[String(s.codigo).padStart(2, '0')] = ambito(s, partiti);
  };
  for (const r of risposte) {
    if (!r) continue;
    if (r.scope) visita(r.scope); else visita(r);
    for (const m of Array.isArray(r.mapa) ? r.mapa : []) visita(m);
  }
  const quando = [naz, ...Object.values(circ)].map(a => a && a.quando).filter(Boolean).sort().pop() || null;
  return { quando, naz, circ, partiti };
}

/* I comuni di una provincia, dalla risposta con «mapa» al livello 90. Per ogni comune (codice
   INE di cinque cifre) lo stesso schema di dati/comuni2023.json, più i seggi elettorali contati:
   [nome, seggi elettorali, censo, bianche, nulle, validi, [codice, voti, …], scrutinati].
   Le candidature hanno il codice del Ministero per questa elezione, con sigla e nome in «partiti». */
export function comuni(risposta) {
  const partiti = {}, m = {};
  let quando = null;
  const visita = s => {
    if (!s || Number(s.nivel) !== 90) return;
    const a = ambito(s, partiti);
    const flat = Object.entries(a.v).sort((x, y) => y[1][0] - x[1][0]).flatMap(([k, [v]]) => [Number(k), v]);
    m[String(s.codigo).padStart(5, '0')] = [a.n, a.mesas, a.censo, a.bianche, a.nulle, a.validi, flat, a.esc];
    if (a.quando && (!quando || a.quando > quando)) quando = a.quando;
  };
  for (const r of [].concat(risposta || [])) {
    if (!r) continue;
    visita(r.scope || r);
    for (const x of Array.isArray(r.mapa) ? r.mapa : []) visita(x);
  }
  return { quando, m, partiti: Object.fromEntries(Object.entries(partiti).map(([k, p]) => [k, [p[0], p[1]]])) };
}

/* Il Senato: ogni circoscrizione (una provincia, livello 30, o un'isola, livello 70) con i
   senatori per candidatura («cargos») e, se il Ministero li pubblica, i candidati con i loro voti.
   Nel 2026 i candidati stanno in escrutinio.candidaturas: { nombre, apellido1, apellido2, votos,
   partido: { codigo }, cargo }, con cargo vero per gli eletti. Restano letti anche i campi che
   si erano ipotizzati per il 2023 (partidos[].candidatos, electo/elegido).
   { quando, d: [ { codigo, nivel, n, mesas, esc, validi, partiti: { cod: [sigla, nome, seggi] },
                    cand: [[nome, cod, voti, eletto]] } ] } */
const candidato = (c, cod) => [
  [c.nombre, c.apellido1 || c.primerApellido, c.apellido2 || c.segundoApellido].filter(Boolean).join(' ') || c.nombreCompleto || '',
  cod, n(c.votos), c.cargo === true || c.electo || c.elegido || c.electoProvisional ? 1 : 0];

export function senato(risposte) {
  const d = []; let quando = null;
  const visita = s => {
    const liv = Number(s && s.nivel); if (liv !== 30 && liv !== 70) return;
    const e = s.escrutinio || {}, partiti = {}, cand = [];
    for (const p of e.partidos || []) {
      const cod = String(p.codigo), [sigla, nome, naz] = voce(p, CANDIDATURE.s);
      partiti[cod] = [sigla, nome, n(p.cargos), naz];
      for (const c of p.candidatos || []) cand.push(candidato(c, cod));
    }
    for (const c of e.candidaturas || []) if (c && c.partido && c.partido.codigo != null) cand.push(candidato(c, String(c.partido.codigo)));
    d.push({ codigo: String(s.codigo), nivel: liv, n: s.nombre || '', mesas: n(s.numMesas), esc: n(e.mesasEscrutadas), validi: n(e.votosValidos), partiti, cand: cand.sort((a, b) => b[2] - a[2]) });
    const f = data(e.fecha);
    if (f && (!quando || f > quando)) quando = f;
  };
  for (const r of [].concat(risposte || [])) {
    if (!r) continue;
    visita(r.scope || r);
    for (const x of Array.isArray(r.mapa) ? r.mapa : []) visita(x);
  }
  return { quando, d };
}

/* L'affluenza della giornata, dal «momento» diurno del sito (getScopeData/<id>/1/2/0/…):
   ogni ambito ha avances.avances = [{ hora: '14:00', participacion, votos, porcentajeMesas,
   avancesAnt: [{ convocatoria: '07-23', participacion }] }, …], con il dato del 2023 alla stessa
   ora. Verificato il 28/11/2026 sulla Spagna, sulle province e sui comuni (livello 90).
   { quando, ore: ['14:00', '18:00'],
     naz: AFF, prov: { '28': AFF }, m: { '28079': [censo, pct1, pct1 2023, pct2, pct2 2023, …] } }
   AFF = { n, censo, a: [[ora, pct, votanti, pct 2023, % seggi che hanno comunicato]] }.
   Una percentuale a 0 vuol dire che quell'ambito non ha ancora comunicato quella rilevazione. */
function avanzi(s) {
  const a = s && s.avances && Array.isArray(s.avances.avances) ? s.avances.avances : [];
  return a.slice().sort((x, y) => n(x.orden) - n(y.orden)).map(x => {
    const ant = (x.avancesAnt || []).find(y => y && y.participacion != null);
    return [String(x.hora || ''), n(x.participacion), n(x.votos), ant ? n(ant.participacion) : null, n(x.porcentajeMesas)];
  });
}
export function affluenza(risposte) {
  const out = { quando: null, ore: [], naz: null, prov: {}, m: {} };
  const visita = s => {
    if (!s || typeof s !== 'object') return;
    const liv = Number(s.nivel), a = avanzi(s);
    if (!a.length) return;
    if (a.length > out.ore.length) out.ore = a.map(x => x[0]);
    const censo = n(s.censoINE) || n(s.censoNoche);
    if (liv === 1) out.naz = { n: s.nombre || '', censo, a };
    else if (liv === 30) out.prov[String(s.codigo).padStart(2, '0')] = { n: s.nombre || '', censo, a };
    else if (liv === 90) out.m[String(s.codigo).padStart(5, '0')] = [censo, ...a.flatMap(x => [x[1], x[3] == null ? 0 : x[3]])];
    const f = data(s.avances.fecha);
    if (f && (!out.quando || f > out.quando)) out.quando = f;
  };
  for (const r of [].concat(risposte || [])) {
    if (!r) continue;
    visita(r.scope || r);
    for (const x of Array.isArray(r.mapa) ? r.mapa : []) visita(x);
  }
  return out;
}

/* Il riassunto ha senso? Almeno la Spagna o una circoscrizione, e i nomi dei partiti. */
export const valido = R => !!R && (!!R.naz || Object.keys(R.circ).length > 0);

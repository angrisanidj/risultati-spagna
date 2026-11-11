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
   AMBITO = { n, mesas, esc, censo, votanti, nulle, bianche, validi, pctEsc, v: { codice: [voti, seggi] } } */

export const scopeId = (codigo, livello) => Number(String(codigo) + livello).toString(16).padStart(24, '0');
export const PROVINCE = Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, '0'));

const n = x => {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  if (typeof x === 'object') return n(x.pro != null && (x.pro || x.def == null) ? x.pro : x.def);
  const v = Number(String(x).replace(',', '.'));
  return isFinite(v) ? v : 0;
};

/* Un ambito del Ministero, nel formato compatto. partiti raccoglie i nomi una volta sola. */
export function ambito(s, partiti) {
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
  out.quando = e.fecha || null;
  for (const p of e.partidos || []) {
    const cod = String(p.codigo);
    const ag = (p.agrupaciones || []).find(a => a && a.nivel === 1);
    if (!partiti[cod]) partiti[cod] = [p.siglas || cod, p.nombre || '', ag && ag.siglas ? ag.siglas : ''];
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
   Il formato dei candidati del Senato non si è potuto verificare sul 2023: si leggono i campi
   più probabili (nombre, votos, electo/elegido) e, se mancano, restano i seggi per candidatura.
   { quando, d: [ { codigo, nivel, n, mesas, esc, validi, partiti: { cod: [sigla, nome, seggi] },
                    cand: [[nome, cod, voti, eletto]] } ] } */
export function senato(risposte) {
  const d = []; let quando = null;
  const visita = s => {
    const liv = Number(s && s.nivel); if (liv !== 30 && liv !== 70) return;
    const e = s.escrutinio || {}, partiti = {}, cand = [];
    for (const p of e.partidos || []) {
      const cod = String(p.codigo);
      const ag = (p.agrupaciones || []).find(a => a && a.nivel === 1);
      partiti[cod] = [p.siglas || cod, p.nombre || '', n(p.cargos), ag && ag.siglas ? ag.siglas : ''];
      for (const c of p.candidatos || []) {
        const nome = [c.nombre, c.apellido1 || c.primerApellido, c.apellido2 || c.segundoApellido].filter(Boolean).join(' ') || c.nombreCompleto || '';
        cand.push([nome, cod, n(c.votos), c.electo || c.elegido || c.electoProvisional ? 1 : 0]);
      }
    }
    d.push({ codigo: String(s.codigo), nivel: liv, n: s.nombre || '', mesas: n(s.numMesas), esc: n(e.mesasEscrutadas), validi: n(e.votosValidos), partiti, cand: cand.sort((a, b) => b[2] - a[2]) });
    if (e.fecha && (!quando || e.fecha > quando)) quando = e.fecha;
  };
  for (const r of [].concat(risposte || [])) {
    if (!r) continue;
    visita(r.scope || r);
    for (const x of Array.isArray(r.mapa) ? r.mapa : []) visita(x);
  }
  return { quando, d };
}

/* Il riassunto ha senso? Almeno la Spagna o una circoscrizione, e i nomi dei partiti. */
export const valido = R => !!R && (!!R.naz || Object.keys(R.circ).length > 0);

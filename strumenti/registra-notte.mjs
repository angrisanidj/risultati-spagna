/* Il registratore della notte: la storia del grafico «La forchetta che si stringe» per chi apre
   la pagina a metà spoglio.

   Un browser senza schermo (Chromium, con Playwright) apre la pagina pubblicata con
   ?registra=1 e la lascia lavorare come farebbe un lettore: legge il feed, i comuni, calcola la
   proiezione. Ogni minuto lo script legge la storia che la pagina ha accumulato (TR.p) e, se è
   cambiata, la pubblica in dati/live/traccia.json nel ramo «notte» del repository, con le API di
   GitHub (un commit per aggiornamento, su quel ramo soltanto: main e Pages non si toccano). La
   pagina dei lettori la rilegge da raw.githubusercontent.com ogni due minuti.

   Il calcolo è quello della pagina, non una sua copia: i numeri pubblicati sono identici a quelli
   che vede chi tiene la pagina aperta dall'inizio.

   Se il registratore riparte a notte iniziata (un secondo giro del workflow, o un lancio a mano),
   non cancella niente: tiene i punti già pubblicati prima del suo primo punto e aggiunge i suoi.

   Uso (lo lancia il workflow .github/workflows/notte.yml; serve GITHUB_TOKEN con contents: write):
     node strumenti/registra-notte.mjs                       la notte vera, fino a 340 minuti
     node strumenti/registra-notte.mjs --prova --ramo=notte-prova --minuti=15
                                                             la prova generale del 2023 al 100%
   Opzioni: --url=… (la pagina), --ramo=notte, --minuti=340, --ogni=60 (secondi). */
import { chromium } from 'playwright';

const arg = (k, d) => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a == null ? d : a.includes('=') ? a.slice(a.indexOf('=') + 1) : true; };
const PROVA = !!arg('prova', false);
const RAMO = String(arg('ramo', 'notte'));
const MINUTI = Number(arg('minuti', 340)), OGNI = Number(arg('ogni', 60)) * 1000;
const URL_ = String(arg('url', 'https://angrisanidj.github.io/risultati-spagna/')) + '?registra=1' + (PROVA ? '&prova=2023' : '');
const REPO = process.env.GITHUB_REPOSITORY || 'angrisanidj/risultati-spagna', TOKEN = process.env.GITHUB_TOKEN;
const PERCORSO = 'dati/live/traccia.json';
const dorme = ms => new Promise(r => setTimeout(r, ms));
const ora = () => new Date().toISOString().slice(11, 19);
if (!TOKEN) { console.error('Manca GITHUB_TOKEN'); process.exit(1); }

async function gh(metodo, percorso, corpo) {
  const r = await fetch('https://api.github.com/repos/' + REPO + percorso, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'registra-notte' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const testo = await r.text();
  return { stato: r.status, j: testo ? JSON.parse(testo) : null };
}
/* il ramo, se non c'è, nasce da main */
async function preparaRamo() {
  const r = await gh('GET', '/git/ref/heads/' + RAMO);
  if (r.stato === 200) return;
  const m = await gh('GET', '/git/ref/heads/main');
  if (m.stato !== 200) throw new Error('main non trovato: ' + m.stato);
  const c = await gh('POST', '/git/refs', { ref: 'refs/heads/' + RAMO, sha: m.j.object.sha });
  if (c.stato !== 201) throw new Error('ramo ' + RAMO + ' non creato: ' + c.stato + ' ' + JSON.stringify(c.j));
  console.log(ora(), 'creato il ramo', RAMO);
}
async function leggi() {
  const r = await gh('GET', '/contents/' + PERCORSO + '?ref=' + encodeURIComponent(RAMO));
  if (r.stato !== 200) return { sha: null, p: [] };
  try { const j = JSON.parse(Buffer.from(r.j.content, 'base64').toString('utf8')); return { sha: r.j.sha, p: Array.isArray(j.p) ? j.p : [] }; }
  catch (_) { return { sha: r.j.sha, p: [] }; }
}
async function scrivi(testo, sha) {
  const corpo = { message: 'Storia della notte: ' + ora(), content: Buffer.from(testo).toString('base64'), branch: RAMO };
  if (sha) corpo.sha = sha;
  const r = await gh('PUT', '/contents/' + PERCORSO, corpo);
  if (r.stato === 200 || r.stato === 201) return r.j.content.sha;
  if (r.stato === 409 || r.stato === 422) return null;   /* sha superato: si rilegge e si riprova */
  throw new Error('scrittura fallita: ' + r.stato + ' ' + JSON.stringify(r.j).slice(0, 300));
}
/* i numeri arrotondati: il file resta piccolo */
const tondo = q => {
  const o = { x: Math.round(q.x * 1e5) / 1e5 };
  for (const k of ['r', 'p', 'a', 'b', 'a95', 'b95']) if (q[k]) o[k] = q[k];
  return o;
};

await preparaRamo();
let { sha, p: prima } = await leggi();
console.log(ora(), 'ramo', RAMO, '·', prima.length, 'punti già pubblicati');

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log(ora(), 'errore nella pagina:', e.message));
await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
console.log(ora(), 'aperta', URL_);
if (PROVA) {
  await page.waitForFunction(() => typeof PROIEZ !== 'undefined' && PROIEZ.controllo, null, { timeout: 180000 });
  await page.evaluate(() => { document.getElementById('provaRange').value = 100; provaApplica(); });
}

const fine = Date.now() + MINUTI * 60000;
let ultimo = '', fermi = 0;
while (Date.now() < fine) {
  await dorme(OGNI);
  let st;
  try { st = await page.evaluate(() => ({ p: TR.p, frac: S.D ? S.D.naz.frac : 0, fonte: S.fonteDati })); }
  catch (e) { console.log(ora(), 'pagina non leggibile:', e.message); await page.reload({ waitUntil: 'load' }).catch(() => { }); continue; }
  const mie = st.p.map(tondo);
  if (!mie.length) { console.log(ora(), 'in attesa dei dati · fonte', st.fonte || '—'); continue; }
  const tutti = prima.filter(q => q.x < mie[0].x - 1e-9).concat(mie);
  const corpo = JSON.stringify(tutti);
  if (corpo === ultimo) {
    fermi++;
    if ((PROVA && fermi >= 3) || (!PROVA && st.frac >= 0.999 && fermi >= 3)) break;   /* finito */
    continue;
  }
  fermi = 0;
  const testo = JSON.stringify({ quando: new Date().toISOString(), nota: 'Storia del grafico «La forchetta che si stringe», scritta da strumenti/registra-notte.mjs', p: tutti });
  let nuovo = await scrivi(testo, sha);
  if (!nuovo) { sha = (await leggi()).sha; nuovo = await scrivi(testo, sha); }
  if (nuovo) { sha = nuovo; ultimo = corpo; console.log(ora(), 'pubblicati', tutti.length, 'punti · scrutinio', (st.frac * 100).toFixed(1) + '%'); }
}
await browser.close();
console.log(ora(), 'fine');

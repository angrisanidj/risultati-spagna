/* La proiezione dello spoglio fuori dal filo principale della pagina: sul telefono le
   simulazioni impiegano qualche secondo, e la pagina deve restare fluida intanto.

   Messaggi:
   - { tipo: 'base', base }: l'elezione di confronto, una volta;
   - { tipo: 'controllo', base19, v23, seggi23 }: i dati del controllo sull'ordine di arrivo,
     una volta (novembre 2019 e luglio 2023 per comune, i seggi del 2023);
   - { tipo: 'proietta', id, live, seggi, k }: la proiezione; k sono le parti contate di ogni
     comune ({ ine: 0…1 }), per il controllo.

   Il controllo sull'ordine di arrivo: con gli stessi comuni contati stanotte, nella stessa
   misura, il modello rifà la proiezione da novembre 2019 al 2023, di cui si conosce il risultato.
   L'errore che fa dice quanto l'ordine di arrivo di stanotte è insidioso per il modello: se è
   molto più alto di quello del backtest, la pagina avverte e non usa la proiezione nei titoli. */
import { proietta, famiglia, dhondt } from './modello.js';

let base = null, ctl = null;
const destra = s => Object.entries(s).reduce((a, [g, n]) => a + (famiglia(g) === 'PPF' || g === 'VOX' ? n : 0), 0);
const spostati = (a, b) => { let s = 0; for (const g of new Set([...Object.keys(a), ...Object.keys(b)])) s += Math.abs((a[g] || 0) - (b[g] || 0)); return s / 2; };

onmessage = e => {
  const d = e.data;
  if (d.tipo === 'base') { base = d.base; return; }
  if (d.tipo === 'controllo') {
    /* il risultato vero del 2023 (conteggio della notte, senza l'estero), con i seggi del 2023 */
    const tot = {};
    for (const [ine, x] of Object.entries(d.v23)) {
      const t = tot[ine.slice(0, 2)] = tot[ine.slice(0, 2)] || { v: {}, validi: 0 };
      for (const g in x.v) t.v[g] = (t.v[g] || 0) + x.v[g]; t.validi += x.validi;
    }
    const vero = {};
    for (const p in d.seggi23) { const s = dhondt(tot[p].v, tot[p].validi, d.seggi23[p]); for (const g in s) vero[g] = (vero[g] || 0) + s[g]; }
    ctl = { ...d, vero };
    return;
  }
  if (d.tipo !== 'proietta') return;
  if (!base) { postMessage({ id: d.id, attesa: true }); return; }   /* la base non è ancora arrivata */
  try {
    const R = proietta({ base, live: d.live, seggi: d.seggi, famiglia, par: d.par || {} });
    let controllo = null;
    if (ctl && d.k) {
      const live = {};
      for (const [ine, k] of Object.entries(d.k)) {
        const x = ctl.v23[ine]; if (!x || !(k > 0)) continue;
        const v = {}; for (const g in x.v) v[g] = Math.round(x.v[g] * k);
        live[ine] = { v, validi: Math.round(x.validi * k), mesas: x.mesas, esc: Math.max(1, Math.round(x.mesas * k)) };
      }
      const C = proietta({ base: ctl.base19, live, seggi: ctl.seggi23, famiglia, par: { nSim: 1 } });
      controllo = { spostati: spostati(C.seggi, ctl.vero), destra: Math.abs(destra(C.seggi) - destra(ctl.vero)), frac: C.frac };
    }
    postMessage({ id: d.id, controllo, R: { seggi: R.seggi, int: R.int, perProv: R.perProv, voti: R.voti, validi: R.validi, frac: R.frac, campioni: R.campioni } });
  } catch (err) { postMessage({ id: d.id, errore: String(err && err.message || err) }); }
};

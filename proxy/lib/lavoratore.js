/* La proiezione dello spoglio fuori dal filo principale della pagina: sul telefono le
   simulazioni impiegano qualche secondo, e la pagina deve restare fluida intanto.
   Messaggi: { tipo: 'base', base } una volta, poi { tipo: 'proietta', id, live, seggi }. */
import { proietta, famiglia } from './modello.js';

let base = null;
onmessage = e => {
  const d = e.data;
  if (d.tipo === 'base') { base = d.base; return; }
  if (d.tipo !== 'proietta') return;
  if (!base) { postMessage({ id: d.id, attesa: true }); return; }   /* la base non è ancora arrivata */
  try {
    const R = proietta({ base, live: d.live, seggi: d.seggi, famiglia, par: d.par || {} });
    postMessage({ id: d.id, R: { seggi: R.seggi, int: R.int, perProv: R.perProv, voti: R.voti, validi: R.validi, frac: R.frac, campioni: R.campioni } });
  } catch (err) { postMessage({ id: d.id, errore: String(err && err.message || err) }); }
};

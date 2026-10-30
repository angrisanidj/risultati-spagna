"""La media dei sondaggi, da Wikipedia, nel campo «sondaggi» di stime.json.

Legge la tabella «2026 (with Broad Front)» della voce «Opinion polling for the 2026 Spanish
general election» di Wikipedia in inglese: per ogni sondaggio istituto, committente, date del
campo, campione, quote di voto e, quando ci sono, i seggi stimati dall'istituto.

La media:
- solo i sondaggi con il campo chiuso negli ultimi FINESTRA giorni prima del più recente;
- per ogni istituto solo l'ultimo sondaggio, così chi pubblica ogni settimana non pesa di più;
- peso = recenza (si dimezza ogni EMIVITA giorni) × radice del campione su mille, fra 0,5 e 2;
- esclusi i sondaggi commissionati dai partiti (la riga ha il nome di un partito come istituto);
- dove Frente Amplio e Front Valencià sono una cifra sola, si toglie la media di Front Valencià
  dei sondaggi che li separano.
Il PP nella tabella comprende UPN, che si presenta con il PP in Navarra.

La pagina parte da questa media per proiettare i seggi provincia per provincia: vedi
proiezioneSondaggi() in index.html.

Uso:  python -I strumenti/sondaggi.py           scrive stime.json
      python -I strumenti/sondaggi.py --prova   stampa soltanto
"""
import datetime as dt
import json
import math
import pathlib
import re
import sys
import urllib.parse
import urllib.request

PAGINA = 'Opinion polling for the 2026 Spanish general election'
SEZIONE = '2026 (with Broad Front)'
API = 'https://en.wikipedia.org/w/api.php'
UA = 'risultati-spagna/1.0 (https://angrisanidj.github.io/risultati-spagna/)'
FINESTRA = 21
EMIVITA = 7.0
ANNO = 2026
# intestazione della colonna su Wikipedia -> chiave del partito nella pagina
COLONNE = {'PP': 'PP', 'PSOE': 'PSOE', 'Vox': 'VOX', 'FA': 'FA', 'FV': 'FV', 'ERC': 'ERC', 'Junts': 'JUNTS',
           'EH Bildu': 'BILDU', 'PNV': 'PNV', 'BNG': 'BNG', 'CCa': 'CC', 'Adelante Andalucía (2021)': 'AA',
           'Podemos': 'PODEMOS', 'SALF': 'SALF'}
PARTITI_COME_ISTITUTO = {'PP', 'PSOE', 'VOX', 'SUMAR', 'PODEMOS', 'FA', 'FRENTE AMPLIO', 'ERC', 'JUNTS', 'PNV', 'BNG'}
MESI = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}


def wikitext():
    q = urllib.parse.urlencode({'action': 'parse', 'page': PAGINA, 'prop': 'wikitext', 'format': 'json',
                                'formatversion': 2, 'redirects': 1})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['parse']['wikitext']


def pulisci(t):
    t = re.sub(r'<ref[^>]*/>', '', t)
    t = re.sub(r'<ref[^>]*>.*?</ref>', '', t, flags=re.S)
    return re.sub(r'<!--.*?-->', '', t, flags=re.S)


def dividi_attributi(c):
    """«colspan="2"| 6.6» -> ('colspan="2"', '6.6'): l'ultima barra fuori da [[ ]] e {{ }}."""
    prof, taglio = 0, -1
    for i, ch in enumerate(c):
        if ch in '[{':
            prof += 1
        elif ch in ']}':
            prof -= 1
        elif ch == '|' and prof == 0:
            taglio = i
    return (c[:taglio], c[taglio + 1:]) if taglio >= 0 else ('', c)


def celle(riga):
    out = []
    for linea in riga.split('\n'):
        s = linea.strip()
        if not s.startswith('|') or s.startswith('|-') or s.startswith('|+') or s.startswith('|}'):
            continue
        for c in s[1:].split('||'):
            attr, val = dividi_attributi(c)
            m = re.search(r'colspan="?(\d+)', attr)
            out.append((val.strip(), int(m.group(1)) if m else 1))
    return out


def quota(v):
    v = re.sub(r"'''|''", '', v.split('<br')[0])
    m = re.match(r'\s*(\d+(?:\.\d+)?)', v)
    return float(m.group(1)) if m else None


def seggi(v):
    m = re.search(r'text=(\d+)(?:[/–-](\d+))?', v)
    if not m:
        return None
    a = int(m.group(1))
    return (a + int(m.group(2))) / 2 if m.group(2) else a


def fine_campo(s):
    toks = re.findall(r'(\d{1,2})\s+([A-Za-z]{3})', s)
    if not toks:
        return None
    g, m = toks[-1]
    return dt.date(ANNO, MESI[m.lower()], int(g))


def leggi(t):
    i = t.find('=====' + SEZIONE + '=====')
    if i < 0:
        raise SystemExit('sezione «' + SEZIONE + '» non trovata: la voce di Wikipedia è cambiata')
    tab = pulisci(t[i:t.find('\n|}', i)])
    righe = tab.split('\n|-')
    # le colonne dei partiti, dalla prima riga d'intestazione
    intest = next(r for r in righe if 'Polling firm' in r)
    nomi = []
    for linea in intest.split('\n'):
        if not linea.startswith('!') or 'rowspan' in linea:
            continue
        m = re.search(r'\|([^|\]]+)\]\]\s*$', linea.strip())
        if m:
            nomi.append(re.sub(r'^link=', '', m.group(1).strip()))
    chiavi = [COLONNE.get(n) for n in nomi]
    if None in chiavi:
        raise SystemExit('colonne sconosciute: ' + ', '.join(n for n, k in zip(nomi, chiavi) if not k))
    out = []
    for r in righe:
        c = celle(r)
        if len(c) < 6 or 'Polling firm' in r:
            continue
        istituto = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', c[0][0]).strip()
        if istituto.split('/')[0].strip().upper() in PARTITI_COME_ISTITUTO:
            continue
        data = fine_campo(c[1][0])
        if not data:
            continue
        camp = re.sub(r'\D', '', c[2][0])
        voti, sg, col = {}, {}, 0
        for val, span in c[4:]:
            if col >= len(chiavi):
                break
            k = chiavi[col] if span == 1 else '+'.join(chiavi[col:col + span])
            q, s = quota(val), seggi(val)
            if q is not None:
                voti[k] = q
            if s is not None:
                sg[k] = s
            col += span
        if not all(k in voti for k in ('PP', 'PSOE', 'VOX')):
            continue
        out.append({'istituto': istituto, 'fine': data.isoformat(), 'campione': int(camp) if camp else None,
                    'voti': voti, 'seggi': sg})
    return out


def media(sondaggi):
    ultimo = max(dt.date.fromisoformat(s['fine']) for s in sondaggi)
    dentro = [s for s in sondaggi if (ultimo - dt.date.fromisoformat(s['fine'])).days <= FINESTRA]
    per_istituto = {}
    for s in sorted(dentro, key=lambda s: s['fine']):
        per_istituto[s['istituto'].split('/')[0].strip()] = s
    scelti = sorted(per_istituto.values(), key=lambda s: s['fine'], reverse=True)
    for s in scelti:
        eta = (ultimo - dt.date.fromisoformat(s['fine'])).days
        n = s['campione'] or 1000
        s['peso'] = round(0.5 ** (eta / EMIVITA) * min(2, max(0.5, math.sqrt(n / 1000))), 3)

    def wmedia(campo, k):
        num = den = 0
        for s in scelti:
            if k in s[campo]:
                num += s['peso'] * s[campo][k]
                den += s['peso']
        return (num / den, den) if den else (None, 0)

    out, sout = {}, {}
    for campo, dest in (('voti', out), ('seggi', sout)):
        fv, _ = wmedia(campo, 'FV')
        for k in set(COLONNE.values()):
            if k == 'FA':
                num = den = 0
                for s in scelti:
                    if 'FA' in s[campo]:
                        x = s[campo]['FA']
                    elif 'FA+FV' in s[campo] and fv is not None:
                        x = s[campo]['FA+FV'] - fv
                    else:
                        continue
                    num += s['peso'] * x
                    den += s['peso']
                v = num / den if den else None
            else:
                v, _ = wmedia(campo, k)
            if v is not None:
                dest[k] = round(v, 2 if campo == 'voti' else 1)
    return scelti, out, sout, ultimo


def main():
    sondaggi = leggi(wikitext())
    scelti, voti, seggi_ist, ultimo = media(sondaggi)
    print(f'{len(sondaggi)} sondaggi nella tabella, {len(scelti)} nella media (ultimo campo {ultimo})')
    for s in scelti:
        print(f'  {s["fine"]}  {s["istituto"][:40]:40} peso {s["peso"]:.2f}  PP {s["voti"].get("PP")}  PSOE {s["voti"].get("PSOE")}  Vox {s["voti"].get("VOX")}')
    print('media:', ', '.join(f'{k} {v}' for k, v in sorted(voti.items(), key=lambda x: -x[1])))
    print('seggi degli istituti:', ', '.join(f'{k} {v}' for k, v in sorted(seggi_ist.items(), key=lambda x: -x[1])))
    if '--prova' in sys.argv:
        return
    p = pathlib.Path(__file__).resolve().parent.parent / 'stime.json'
    st = json.loads(p.read_text(encoding='utf-8'))
    st['sondaggi'] = {
        'letto': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
        'ultimo': ultimo.isoformat(), 'finestra': FINESTRA, 'emivita': EMIVITA,
        'fonte': 'https://en.wikipedia.org/wiki/' + PAGINA.replace(' ', '_'),
        'media': voti, 'seggiIstituti': seggi_ist,
        'istituti': [{'n': s['istituto'], 'fine': s['fine'], 'campione': s['campione'], 'peso': s['peso'],
                      'voti': s['voti'], 'seggi': s['seggi']} for s in scelti]
    }
    p.write_text(json.dumps(st, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('scritto', p)


if __name__ == '__main__':
    main()

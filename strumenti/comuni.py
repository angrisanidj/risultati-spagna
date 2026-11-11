"""Risultati del Congresso comune per comune, dai pacchetti ufficiali del Ministero dell'Interno.

I pacchetti «MUNI» di infoelectoral (in strumenti/fonti/) hanno file a lunghezza fissa,
descritti nel FICHEROS.doc del Ministero:
- 03xxaamm.DAT, le candidature: codice, sigla, denominazione;
- 05xxaamm.DAT, i dati generali per comune (233 caratteri): codice INE di provincia e comune,
  distretto (99 = totale comunale), nome, seggi elettorali, censo, schede bianche e nulle,
  voti alle candidature;
- 06xxaamm.DAT, i voti di ogni candidatura per comune (33 caratteri);
- 07xxaamm.DAT, i totali delle province (172 caratteri), con i seggi da assegnare.
Il voto dall'estero (CERA) non è nei comuni: entra solo nei totali provinciali.

Il risultato:
{ "partiti": { codice: [sigla, denominazione] },
  "m": { "28079": [nome, seggi elettorali, censo, bianche, nulle, validi, [codice, voti, …]] },
  "prov": { "28": [seggi da assegnare, voti validi con il CERA] } }

Uso:  python -I strumenti/comuni.py 02202307            scrive dati/comuni2023.json
      python -I strumenti/comuni.py 02201911 USCITA     scrive USCITA
"""
import json
import pathlib
import sys
import zipfile

BASE = pathlib.Path(__file__).resolve().parent.parent


def righe(z, nome):
    return [r.rstrip('\r') for r in z.read(nome).decode('latin-1').split('\n') if r.strip()]


def leggi(codice):
    z = zipfile.ZipFile(BASE / 'strumenti' / 'fonti' / (codice + '_MUNI.zip'))
    suf = codice[:2] + codice[4:8] + '.DAT'          # 02202307 -> 022307.DAT
    partiti = {}
    for r in righe(z, '03' + suf):
        partiti[str(int(r[8:14]))] = [r[14:64].strip(), r[64:214].strip()]
    m = {}
    for r in righe(z, '05' + suf):
        if r[16:18] != '99':          # i distretti delle grandi città: basta il totale comunale
            continue
        n = lambda a, b: int(r[a:b])
        bianche, nulle, cand = n(189, 197), n(197, 205), n(205, 213)
        m[r[11:16]] = [r[18:118].strip(), n(136, 141), n(149, 157), bianche, nulle, bianche + cand, []]
    voti = {}
    for r in righe(z, '06' + suf):
        if r[14:16] != '99':
            continue
        ine, cod, v = r[9:14], str(int(r[16:22])), int(r[22:30])
        if v and ine in m:
            voti.setdefault(ine, []).append((v, cod))
    for ine, l in voti.items():
        for v, cod in sorted(l, reverse=True):
            m[ine][6] += [int(cod), v]
    prov = {}
    for r in righe(z, '07' + suf):
        ccaa, pr, dist = r[9:11], r[11:13], r[13]
        if ccaa == '99' or pr == '99' or dist != '9':
            continue
        n = lambda a, b: int(r[a:b])
        prov[pr] = [n(149, 155), n(125, 133) + n(141, 149)]
    return {'partiti': partiti, 'm': m, 'prov': prov}


def main():
    codice = sys.argv[1] if len(sys.argv) > 1 else '02202307'
    d = leggi(codice)
    diversi = [i for i, x in d['m'].items() if sum(x[6][1::2]) != x[5] - x[3]]
    seggi = sum(p[0] for p in d['prov'].values())
    vc, vp = sum(x[5] for x in d['m'].values()), sum(p[1] for p in d['prov'].values())
    print(f'{codice}: {len(d["m"])} comuni · {len(d["partiti"])} candidature · {len(diversi)} comuni con somme diverse · '
          f'{len(d["prov"])} province, {seggi} seggi · validi nei comuni {vc:,}, con il CERA {vp:,} (estero {vp - vc:,})')
    d = {'nota': f'Congresso, elezione {codice[2:6]}-{codice[6:8]}, per comune: Ministero dell’Interno, {codice}_MUNI.zip. '
                 'Nei comuni non c’è il voto CERA; in «prov» seggi e voti validi con il CERA.', **d}
    uscita = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else BASE / 'dati' / f'comuni{codice[2:6]}.json'
    uscita.parent.mkdir(parents=True, exist_ok=True)
    uscita.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('scritto', uscita, uscita.stat().st_size, 'byte')
    return 1 if diversi or seggi != 350 or len(d['prov']) != 52 else 0


if __name__ == '__main__':
    sys.exit(main())

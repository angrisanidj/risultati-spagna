"""Risultati del Congresso del 23 luglio 2023 comune per comune, da dati/comuni2023.json.

Fonte: il pacchetto ufficiale del Ministero dell'Interno 02202307_MUNI.zip (infoelectoral,
«Área de descargas»), in strumenti/fonti/. Il server di infoelectoral non risponde a tutte le
reti: il file è stato scaricato da un browser e conservato qui.

Il pacchetto ha file a lunghezza fissa (descritti in FICHEROS.doc, dentro lo zip):
- 03022307.DAT, le candidature: codice, sigla, denominazione;
- 05022307.DAT, i dati generali per comune (233 caratteri): codice INE di provincia e comune,
  distretto (99 = totale comunale), nome, seggi elettorali, censo, schede bianche e nulle,
  voti alle candidature;
- 06022307.DAT, i voti di ogni candidatura per comune (33 caratteri).
Il voto dall'estero (CERA) non è nei comuni: si somma solo al totale provinciale. Per questo la
somma dei comuni di una provincia è un po' sotto il risultato di dati/base2023.json.

Il risultato:
{ "partiti": { codice: [sigla, denominazione] },
  "m": { "28079": [nome, seggi elettorali, censo, bianche, nulle, validi, [codice, voti, codice, voti, …]] } }

Uso:  python -I strumenti/comuni2023.py
"""
import json
import pathlib
import zipfile

BASE = pathlib.Path(__file__).resolve().parent.parent
ZIP = BASE / 'strumenti' / 'fonti' / '02202307_MUNI.zip'


def righe(z, nome):
    return [r.rstrip('\r') for r in z.read(nome).decode('latin-1').split('\n') if r.strip()]


def main():
    z = zipfile.ZipFile(ZIP)
    partiti = {}
    for r in righe(z, '03022307.DAT'):
        partiti[str(int(r[8:14]))] = [r[14:64].strip(), r[64:214].strip()]
    m = {}
    for r in righe(z, '05022307.DAT'):
        if r[16:18] != '99':          # i distretti delle grandi città: basta il totale comunale
            continue
        ine = r[11:16]
        n = lambda a, b: int(r[a:b])
        bianche, nulle, cand = n(189, 197), n(197, 205), n(205, 213)
        m[ine] = [r[18:118].strip(), n(136, 141), n(149, 157), bianche, nulle, bianche + cand, []]
    voti = {}
    for r in righe(z, '06022307.DAT'):
        if r[14:16] != '99':
            continue
        ine, cod, v = r[9:14], str(int(r[16:22])), int(r[22:30])
        if v:
            voti.setdefault(ine, []).append((v, cod))
    for ine, l in voti.items():
        for v, cod in sorted(l, reverse=True):
            m[ine][6] += [int(cod), v]
    # controlli: i voti alle liste tornano con il totale del comune, e le province con la base 2023
    diversi = [i for i, x in m.items() if sum(x[6][1::2]) != x[5] - x[3]]
    base = json.loads((BASE / 'dati' / 'base2023.json').read_text(encoding='utf-8'))['circ']
    print(len(m), 'comuni ·', len(partiti), 'candidature ·', len(diversi), 'comuni con somme diverse')
    tot_c = tot_b = 0
    for c, b in sorted(base.items()):
        vc = sum(x[5] for i, x in m.items() if i[:2] == c)
        tot_c += vc
        tot_b += b['validi']
        if vc > b['validi'] or vc < b['validi'] * 0.95:
            print('  provincia', c, 'comuni', vc, 'base', b['validi'])
    print(f'voti validi nei comuni {tot_c:,} · nella base con l’estero {tot_b:,} · differenza {tot_b - tot_c:,} (CERA)')
    out = {'nota': 'Congresso, 23 luglio 2023, per comune: Ministero dell’Interno, 02202307_MUNI.zip. Senza il voto CERA.',
           'partiti': partiti, 'm': m}
    (BASE / 'dati' / 'comuni2023.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('scritto dati/comuni2023.json', (BASE / 'dati' / 'comuni2023.json').stat().st_size, 'byte')


if __name__ == '__main__':
    main()

"""Risultati definitivi del Congresso del 23 luglio 2023, circoscrizione per circoscrizione.

Legge da Wikipedia (en) la tabella «Summary of the 23 July 2023 Congress of Deputies election
results» di ognuna delle 52 voci «<Provincia> (Congress of Deputies constituency)» e scrive
dati/base2023.json. Le cifre sono quelle definitive della Junta Electoral Central, voto
degli spagnoli all'estero (CERA) compreso. Il server dei dati storici del Ministero
(infoelectoral.interior.gob.es) non risponde fuori dalla Spagna: da lì si potrebbe rifare
lo stesso file con i dati ufficiali.

Uso:  python -I strumenti/base2023.py
"""
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

# codice INE della provincia -> titolo della voce su Wikipedia
VOCI = {
    '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz',
    '07': 'Balearic Islands', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz',
    '12': 'Castellón', '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca',
    '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca',
    '23': 'Jaén', '24': 'León', '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid',
    '29': 'Málaga', '30': 'Murcia', '31': 'Navarre', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia',
    '35': 'Las Palmas', '36': 'Pontevedra', '37': 'Salamanca', '38': 'Santa Cruz de Tenerife',
    '39': 'Cantabria', '40': 'Segovia', '41': 'Seville', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel',
    '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid', '48': 'Biscay', '49': 'Zamora', '50': 'Zaragoza',
    '51': 'Ceuta', '52': 'Melilla',
}
API = 'https://en.wikipedia.org/w/api.php'
UA = 'risultati-spagna/1.0 (https://angrisanidj.github.io/risultati-spagna/)'


def wikitext(titolo):
    q = urllib.parse.urlencode({'action': 'parse', 'page': titolo, 'prop': 'wikitext', 'format': 'json',
                                'formatversion': 2, 'redirects': 1})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['parse']['wikitext']


def numero(s):
    s = re.sub(r"<[^>]+>|'''|''", '', s)
    m = re.search(r'\d[\d,]*', s)
    return int(m.group(0).replace(',', '')) if m else 0


def celle(riga):
    """Le celle di una riga di tabella wiki, senza attributi di stile."""
    out = []
    for linea in riga.split('\n'):
        linea = linea.strip()
        if not linea.startswith('|') or linea.startswith('|-') or linea.startswith('|+'):
            continue
        for c in linea[1:].split('||'):
            # «style=...| valore»: l'attributo sta prima dell'ultima barra fuori dalle parentesi
            prof, taglio = 0, -1
            for i, ch in enumerate(c):
                if ch in '[{':
                    prof += 1
                elif ch in ']}':
                    prof -= 1
                elif ch == '|' and prof == 0:
                    taglio = i
            out.append(c[taglio + 1:].strip() if taglio >= 0 else c.strip())
    return out


def leggi(cod, titolo):
    t = wikitext(titolo + ' (Congress of Deputies constituency)')
    i = t.find('Summary of the 23 July 2023')
    if i < 0:
        raise ValueError('tabella 2023 non trovata')
    tab = t[i:t.find('|}', i)]
    righe = tab.split('\n|-')
    partiti, tot = [], {}
    for r in righe[1:]:
        c = celle(r)
        if not c:
            continue
        testo = ' '.join(c)
        if len(c) >= 6 and re.search(r'\((?:[^()]|\([^()]*\))+\)\s*(<sup>.*)?$', c[1]):
            nome = re.sub(r'<sup>.*', '', c[1]).strip()
            sig = re.search(r'\(((?:[^()]|\([^()]*\))+)\)\s*$', nome).group(1)
            nome_l = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', nome[:nome.rfind('(')]).strip()
            partiti.append({'s': sig, 'n': nome_l, 'v': numero(c[2]), 'e': numero(c[5])})
            continue
        low = testo.lower()
        for chiave, nome in (('blank ballots', 'bianche'), ('total', 'totale'), ('valid votes', 'validi'),
                             ('invalid votes', 'nulle'), ('votes cast / turnout', 'votanti'),
                             ('abstentions', 'astenuti'), ('registered voters', 'elettori')):
            if low.startswith(chiave) and nome not in tot:
                tot[nome] = numero(c[1] if len(c) > 1 else '')
                break
    return partiti, tot


def main():
    base = pathlib.Path(__file__).resolve().parent.parent
    out = {'nota': 'Congresso, 23 luglio 2023: risultati definitivi per circoscrizione (CERA compreso), '
                   'dalle voci «… (Congress of Deputies constituency)» di Wikipedia in inglese.', 'circ': {}}
    errori = 0
    for cod, titolo in VOCI.items():
        try:
            p, t = leggi(cod, titolo)
            sp = sum(x['v'] for x in p)
            seggi = sum(x['e'] for x in p)
            ok = abs(sp + t.get('bianche', 0) - t.get('validi', 0)) <= 2
            print(f'{cod} {titolo:24} liste {len(p):2} seggi {seggi:2} validi {t.get("validi")} '
                  f'{"ok" if ok else "SOMMA DIVERSA: " + str(sp + t.get("bianche", 0))}')
            if not ok:
                # Cáceres: nella voce i «Valid votes» hanno una cifra sbagliata (275.851 invece di
                # 235.851). Fa fede la somma di liste e bianche, se torna con votanti e nulle.
                if abs(t.get('votanti', 0) - t.get('nulle', 0) - sp - t.get('bianche', 0)) <= 2:
                    print('   validi corretti con la somma di liste e bianche, che torna con votanti meno nulle')
                    t['validi'] = sp + t.get('bianche', 0)
                else:
                    errori += 1
            out['circ'][cod] = {'n': titolo, **t, 'p': p}
        except Exception as e:  # noqa: BLE001
            errori += 1
            print(cod, titolo, 'ERRORE', e)
        time.sleep(0.4)
    tot = sum(sum(x['e'] for x in c['p']) for c in out['circ'].values())
    print('seggi totali', tot, '· errori', errori)
    (base / 'dati').mkdir(exist_ok=True)
    (base / 'dati' / 'base2023.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return 1 if errori or tot != 350 else 0


if __name__ == '__main__':
    sys.exit(main())

"""Copia dati/base2023.json e dati/mappa.json dentro index.html.

La pagina resta un file unico: i due blocchi <script type="application/json" id="dati-…">
contengono i dati. Si rilancia dopo aver rifatto uno dei due file con base2023.py o mappa.py.

Uso:  python -I strumenti/incorpora.py
"""
import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parent.parent
BLOCCHI = {'dati-base2023': 'dati/base2023.json', 'dati-mappa': 'dati/mappa.json'}


def main():
    p = BASE / 'index.html'
    t = p.read_text(encoding='utf-8')
    for ident, file in BLOCCHI.items():
        dati = (BASE / file).read_text(encoding='utf-8').strip().replace('</', '<\\/')
        blocco = f'<script type="application/json" id="{ident}">{dati}</script>'
        rx = re.compile(r'<script type="application/json" id="' + ident + r'">.*?</script>', re.S)
        if not rx.search(t):
            raise SystemExit('manca il blocco ' + ident + ' in index.html')
        t = rx.sub(lambda m: blocco, t)
        print(ident, len(dati), 'byte')
    p.write_text(t, encoding='utf-8')


if __name__ == '__main__':
    main()

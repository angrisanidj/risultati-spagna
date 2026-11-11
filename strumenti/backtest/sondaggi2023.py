"""La media dei sondaggi come sarebbe stata il 17 luglio 2023, per il backtest.

Usa lo stesso codice di strumenti/sondaggi.py (lettura della tabella e media), sulla voce di
Wikipedia dei sondaggi del 2023, tabella «2023 (Podemos within Sumar)». Restano solo i
sondaggi con il campo chiuso entro il 17 luglio: in Spagna dal giorno dopo non si possono
pubblicare, e quelli fatti dopo sono usciti all'estero (la tabella li segna in rosa).

Scrive strumenti/backtest/sondaggi2023.json; la proiezione si prova con sondaggi2023.mjs.
Uso:  python -I strumenti/backtest/sondaggi2023.py
"""
import datetime as dt
import json
import pathlib
import sys

QUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(QUI.parent))
import sondaggi as S  # noqa: E402

S.PAGINA = 'Opinion polling for the 2023 Spanish general election'
S.SEZIONE = '2023 (Podemos {{abbr|w/i|within}} Sumar)'
S.ANNO = 2023
S.COLONNE = {'PSOE': 'PSOE', 'PP': 'PP', 'Vox': 'VOX', 'Sumar': 'FA', 'ERC': 'ERC', 'Junts': 'JUNTS', 'PNV': 'PNV',
             'EH Bildu': 'BILDU', 'CUP': 'CUP', 'CCa': 'CC', 'BNG': 'BNG', 'UPN': 'UPN', 'EV': 'EV'}
LIMITE = dt.date(2023, 7, 17)


def main():
    tutti = S.leggi(S.wikitext())
    prima = [s for s in tutti if dt.date.fromisoformat(s['fine']) <= LIMITE]
    scelti, voti, seggi, ultimo = S.media(prima)
    print(f'{len(tutti)} sondaggi nella tabella, {len(prima)} entro il 17 luglio, {len(scelti)} nella media (ultimo {ultimo})')
    print('media:', ', '.join(f'{k} {v}' for k, v in sorted(voti.items(), key=lambda x: -x[1])))
    print('seggi degli istituti:', ', '.join(f'{k} {v}' for k, v in sorted(seggi.items(), key=lambda x: -x[1])))
    (QUI / 'sondaggi2023.json').write_text(json.dumps({'ultimo': ultimo.isoformat(), 'media': voti, 'seggiIstituti': seggi,
                                                       'istituti': [{'n': s['istituto'], 'fine': s['fine'], 'peso': s['peso']} for s in scelti]},
                                                      ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()

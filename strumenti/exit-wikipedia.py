"""Gli exit poll da Wikipedia, come riserva degli screenshot: li scrive in stime.json.

La sera del voto gli exit poll si inseriscono a mano (screenshot dei grafici delle reti, poi
commit di stime.json): è la strada più veloce. Questo script è la riserva, se in quel momento
nessuno può farlo. Legge la tabella dei sondaggi della voce «Opinion polling for the 2026
Spanish general election» di Wikipedia in inglese, la stessa di strumenti/sondaggi.py: gli
exit poll sono le righe con la data del voto. Nel 2023 il primo (Sigma Dos per RTVE) è
comparso alle 20:21, 21 minuti dopo la chiusura dei seggi, gli altri entro le 21:15.

Cosa scrive:
- una voce di «exit» per istituto, con la chiave «wiki-…» e «fonte»: «wikipedia», i seggi
  (forchette dove Wikipedia scrive «145/150») e l'ora italiana in cui la riga è comparsa;
- le voci scritte a mano non si toccano mai, e se un istituto è già stato inserito a mano la
  riga di Wikipedia si salta;
- le voci da Wikipedia seguono la tabella: se una riga cambia, cambia; se sparisce (una
  modifica annullata), sparisce;
- il campo «sondaggi» non si tocca.

I controlli, perché Wikipedia la può modificare chiunque: la riga deve avere la data del voto,
i seggi di PP, PSOE e Vox, ogni valore fra 0 e 200 e le forchette in ordine; la somma dei
minimi non può superare i 350 seggi e, se ci sono almeno otto partiti, la somma dei centri
deve stare fra 320 e 360. Prima delle 20:00 non si pubblica niente: la legge vieta gli exit
poll prima della chiusura dei seggi, quindi una riga comparsa prima non è un exit poll.

Uso:
  python -I strumenti/exit-wikipedia.py                una lettura: stampa cosa scriverebbe
  python -I strumenti/exit-wikipedia.py --scrivi       una lettura, e scrive stime.json
  python -I strumenti/exit-wikipedia.py --giro         ogni minuto dalle 19:58 alle 22:30 del 29
                                                       novembre: commit, push e pubblicazione del
                                                       sito a ogni novità (GitHub Actions)
  python -I strumenti/exit-wikipedia.py --prova        rifà la notte del 2023, una revisione della
                                                       pagina dopo l'altra, in stime-prova.json:
                                                       si guarda con ?stime=prova
  Con --prova: --ogni=60 (secondi fra una revisione e l'altra), --pubblica (commit e push).
"""
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import sondaggi as S  # noqa: E402  (le funzioni che leggono la tabella di Wikipedia)

RADICE = pathlib.Path(__file__).resolve().parent.parent
API = 'https://en.wikipedia.org/w/api.php'
RAW = 'https://en.wikipedia.org/w/index.php'
UA = S.UA
SEGGI = 350

NOTTE = {
    'pagina': S.PAGINA, 'giorno': (29, 11), 'utc': 1,             # a fine novembre l'Italia è a UTC+1
    'file': 'stime.json', 'colonne': S.COLONNE,
    'dalle': dt.datetime(2026, 11, 29, 18, 58, tzinfo=dt.timezone.utc),   # 19:58 italiane
    'alle': dt.datetime(2026, 11, 29, 21, 30, tzinfo=dt.timezone.utc),    # 22:30 italiane
    'chiusura': dt.datetime(2026, 11, 29, 19, 0, tzinfo=dt.timezone.utc),
}
# la prova: la notte del 2023, con le colonne di allora (Sumar al posto di Frente Amplio)
PROVA = {
    'pagina': 'Opinion polling for the 2023 Spanish general election', 'giorno': (23, 7), 'utc': 2,
    'file': 'stime-prova.json',
    'colonne': {'PSOE': 'PSOE', 'PP': 'PP', 'Sumar': 'FA', 'Vox': 'VOX', 'ERC': 'ERC', 'JxCat': 'JUNTS',
                'PNV': 'PNV', 'EH Bildu': 'BILDU', 'CUP': 'CUP', 'CCa': 'CC', 'BNG': 'BNG', 'UPN': 'UPN'},
    'sezione': r'^=+\s*2023 \(Podemos',
    'revisioni': ('2023-07-23T17:50:00Z', '2023-07-23T19:30:00Z'),
}


def scarica(url, tentativi=3):
    for i in range(tentativi):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8')
        except Exception as e:  # noqa: BLE001
            if i == tentativi - 1:
                raise
            print('  Wikipedia non risponde (' + str(e) + '): riprovo fra 10 secondi')
            time.sleep(10)


def wikitext(pagina):
    q = urllib.parse.urlencode({'action': 'parse', 'page': pagina, 'prop': 'wikitext', 'format': 'json',
                                'formatversion': 2, 'redirects': 1})
    return json.loads(scarica(API + '?' + q))['parse']['wikitext']


def tabella(t, sez=None):
    """Il testo della tabella dei sondaggi più recente: per il 2026 la stessa di sondaggi.py."""
    if sez:
        m = re.search(sez, t, re.M)
        if not m:
            raise SystemExit('sezione non trovata: ' + sez)
        i = m.start()
    else:
        i = S.sezione(t)
    return S.pulisci(t[i:t.find('\n|}', i)])


def forchetta(v):
    """«28.9<br/>{{font|…|text=113/118}}» -> [113, 118]; «…text=9}}» -> 9; niente -> None."""
    m = re.search(r'text=(\d+)(?:\s*[/–-]\s*(\d+))?', v)
    if not m:
        return None
    a = int(m.group(1))
    return [a, int(m.group(2))] if m.group(2) else a


def righe_exit(tab, colonne, giorno):
    righe = tab.split('\n|-')
    intest = next(r for r in righe if 'Polling firm' in r)
    nomi = []
    for linea in intest.split('\n'):
        if not linea.startswith('!') or 'rowspan' in linea:
            continue
        m = re.search(r'\|([^|\]]+)\]\]\s*$', linea.strip())
        if m:
            nomi.append(re.sub(r'^link=', '', m.group(1).strip()))
    chiavi = [colonne.get(n) for n in nomi]   # le colonne che la pagina non conosce si saltano
    out = []
    for r in righe:
        c = S.celle(r)
        if len(c) < 6 or 'Polling firm' in r or 'general election' in c[0][0]:
            continue
        toks = re.findall(r'(\d{1,2})\s+([A-Za-z]{3})', c[1][0])
        if not toks or (int(toks[-1][0]), S.MESI.get(toks[-1][1].lower())) != giorno or len(toks) > 1:
            continue   # solo le righe con il campo nel giorno del voto, e solo in quel giorno
        nome = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', c[0][0])
        nome = re.sub(r'\{\{smaller\|([^{}]*)\}\}', r'\1', nome)
        nome = re.sub(r'\{\{.*$', '', nome, flags=re.S)
        nome = re.sub(r"'''|''", '', nome).strip()
        seggi, col = {}, 0
        for val, span in c[4:]:
            if col >= len(chiavi):
                break
            k = chiavi[col]   # due partiti in una cella sola (Frente Amplio con Front Valencià): al primo
            f = forchetta(val)
            if k and f is not None:
                seggi[k] = f
            col += span
        out.append({'nome': nome, 'seggi': seggi})
    return out


def controlla(r):
    """None se la riga va bene, altrimenti il motivo per saltarla."""
    s = r['seggi']
    if r['nome'].split('/')[0].strip().upper() in S.PARTITI_COME_ISTITUTO:
        return 'commissionato da un partito'
    if not all(k in s for k in ('PP', 'PSOE', 'VOX')):
        return 'mancano i seggi di PP, PSOE o Vox'
    lo = hi = cen = 0
    for v in s.values():
        a, b = (v if isinstance(v, list) else [v, v])
        if not (0 <= a <= b <= 200):
            return 'valori fuori scala'
        lo += a
        hi += b
        cen += (a + b) / 2
    if lo > SEGGI:
        return 'i minimi sommano ' + str(lo) + ' seggi'
    if len(s) >= 8 and not (320 <= cen <= 360):
        return 'i centri sommano ' + str(round(cen)) + ' seggi'
    return None


def norma(x):
    return re.sub(r'[^a-z0-9]', '', (x or '').split('/')[0].lower())


def gia_a_mano(istituto, a_mano):
    """L'istituto è già fra gli exit poll scritti a mano? «SigmaDos» si trova in «RTVE · Sigma Dos»."""
    k = norma(istituto)
    for v in a_mano.values():
        for campo in (v.get('n'), v.get('s')):
            c = re.sub(r'[^a-z0-9]', '', (campo or '').lower())
            if len(k) >= 3 and len(c) >= 3 and (k in c or c in k):
                return True
    return False


def unisci(st, righe, ora):
    """Le voci da Wikipedia in st['exit'], senza toccare quelle scritte a mano. True se cambia."""
    ex = st.get('exit') or {}
    a_mano = {k: v for k, v in ex.items() if v.get('fonte') != 'wikipedia'}
    prima = {k: v for k, v in ex.items() if v.get('fonte') == 'wikipedia'}
    nuove = {}
    for r in righe:
        motivo = controlla(r)
        s = r['nome'].split('/')[0].strip()
        k = 'wiki-' + norma(s)
        if motivo:
            print('  saltato', r['nome'] + ':', motivo)
            continue
        if gia_a_mano(s, a_mano):
            print('  saltato', r['nome'] + ': già inserito a mano')
            continue
        if k in nuove:
            continue
        nuove[k] = {'n': r['nome'], 's': s, 'ora': (prima.get(k) or {}).get('ora') or ora,
                    'fonte': 'wikipedia', 'seggi': r['seggi']}
    if nuove == prima:
        return False
    st['exit'] = {**a_mano, **nuove}
    for k in nuove:
        if k not in prima:
            print('  nuovo:', nuove[k]['n'], json.dumps(nuove[k]['seggi'], ensure_ascii=False))
        elif nuove[k] != prima[k]:
            print('  cambiato:', nuove[k]['n'])
    for k in prima:
        if k not in nuove:
            print('  tolto:', prima[k]['n'])
    return True


def ora_italiana(quando, utc):
    return (quando + dt.timedelta(hours=utc)).strftime('%H:%M')


def git(*a, ok=False):
    r = subprocess.run(['git', *a], cwd=RADICE, capture_output=True, text=True)
    if r.returncode and not ok:
        raise RuntimeError('git ' + ' '.join(a) + ': ' + (r.stderr or r.stdout).strip())
    return r.returncode == 0


def pubblica(file, messaggio, calcola):
    """Riparte da origin/main, rifà l'unione, commit e push; se nel frattempo è arrivato un push
    a mano, riprova sopra quello. calcola() riscrive il file e dice se è cambiato."""
    for _ in range(3):
        git('fetch', '-q', 'origin', 'main')
        git('reset', '-q', '--hard', 'origin/main')
        if not calcola():
            return False
        git('add', file)
        git('commit', '-q', '-m', messaggio)
        if git('push', '-q', 'origin', 'HEAD:main', ok=True):
            # il push del token di Actions non fa partire «Pubblica il sito»: si lancia a mano
            subprocess.run(['gh', 'workflow', 'run', 'pages.yml', '--ref', 'main'], cwd=RADICE)
            print('  pubblicato:', messaggio)
            return True
        print('  push rifiutato: riprovo sopra il push arrivato nel frattempo')
    print('  push non riuscito per tre volte: riprovo al giro dopo')
    return False


def passo(conf, testo, ora, scrivi):
    """Una lettura: le righe degli exit poll e l'unione nel file. True se il file cambia."""
    righe = righe_exit(tabella(testo, conf.get('sezione')), conf['colonne'], conf['giorno'])
    p = RADICE / conf['file']
    st = json.loads(p.read_text(encoding='utf-8'))
    cambia = unisci(st, righe, ora)
    if cambia and scrivi:
        st['aggiornato'] = ora + ' · exit poll da Wikipedia'
        p.write_text(json.dumps(st, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return cambia, righe


def giro():
    c = NOTTE
    while dt.datetime.now(dt.timezone.utc) < c['dalle']:
        time.sleep(20)
    print('inizio', dt.datetime.now(dt.timezone.utc).isoformat())
    while dt.datetime.now(dt.timezone.utc) < c['alle']:
        adesso = dt.datetime.now(dt.timezone.utc)
        try:
            testo = wikitext(c['pagina'])
            ora = ora_italiana(adesso, c['utc'])
            if adesso < c['chiusura']:
                righe = righe_exit(tabella(testo), c['colonne'], c['giorno'])
                print(ora, len(righe), 'righe con la data del voto: prima delle 20:00 non si pubblica')
            else:
                nomi = []

                def calcola():
                    cambia, righe = passo(c, testo, ora, True)
                    nomi[:] = [r['nome'].split('/')[0] for r in righe]
                    return cambia
                fatto = pubblica(c['file'], 'Exit poll da Wikipedia, ' + ora, calcola)
                print(ora, 'righe:', ', '.join(nomi) or 'nessuna', '· pubblicato' if fatto else '')
        except Exception as e:  # noqa: BLE001  (un giro andato male non ferma la notte)
            print('  errore:', e)
        time.sleep(max(5, 60 - (dt.datetime.now(dt.timezone.utc) - adesso).total_seconds()))
    print('fine', dt.datetime.now(dt.timezone.utc).isoformat())


def prova():
    c = PROVA
    ogni = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--ogni=')), '60'))
    manda = '--pubblica' in sys.argv
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'revisions', 'titles': c['pagina'], 'rvlimit': 50,
                                'rvstart': c['revisioni'][0], 'rvend': c['revisioni'][1], 'rvdir': 'newer',
                                'rvprop': 'ids|timestamp', 'format': 'json'})
    revs = next(iter(json.loads(scarica(API + '?' + q))['query']['pages'].values()))['revisions']
    # si parte da un file senza exit poll da Wikipedia, tenendo quelli scritti a mano
    p = RADICE / c['file']
    st = json.loads(p.read_text(encoding='utf-8'))
    st['exit'] = {k: v for k, v in (st.get('exit') or {}).items() if v.get('fonte') != 'wikipedia'}
    p.write_text(json.dumps(st, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(len(revs), 'revisioni della pagina del 2023 fra le', c['revisioni'][0], 'e le', c['revisioni'][1])
    for i, rv in enumerate(revs):
        quando = dt.datetime.fromisoformat(rv['timestamp'].replace('Z', '+00:00'))
        ora = ora_italiana(quando, c['utc'])
        testo = scarica(RAW + '?' + urllib.parse.urlencode({'oldid': rv['revid'], 'action': 'raw'}))
        print('revisione delle', ora)
        if manda:
            pubblica(c['file'], 'Prova degli exit poll da Wikipedia: la pagina del 2023 alle ' + ora,
                     lambda: passo(c, testo, ora, True)[0])
        else:
            passo(c, testo, ora, '--scrivi' in sys.argv)
        if i < len(revs) - 1:
            time.sleep(ogni)


def main():
    if ('--giro' in sys.argv or '--pubblica' in sys.argv) and os.environ.get('GITHUB_ACTIONS') != 'true':
        raise SystemExit('--giro e --pubblica rifanno la cartella da origin/main: solo su GitHub Actions')
    if '--prova' in sys.argv:
        return prova()
    if '--giro' in sys.argv:
        return giro()
    adesso = dt.datetime.now(dt.timezone.utc)
    cambia, righe = passo(NOTTE, wikitext(NOTTE['pagina']), ora_italiana(adesso, NOTTE['utc']), '--scrivi' in sys.argv)
    print(len(righe), 'righe con la data del voto;', 'stime.json cambierebbe' if cambia else 'niente da cambiare')


if __name__ == '__main__':
    main()

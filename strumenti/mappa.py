"""Le province come percorsi SVG già proiettati, per la mappa della pagina.

Fonte: es-atlas 0.6.0 (Martín González, licenza MIT), TopoJSON costruito dai confini
dell'Istituto geografico nazionale (IGN). Proiezione equirettangolare con il parallelo
standard a 40° N, che per la Spagna basta; le Canarie sono spostate in un riquadro in basso
a sinistra, come si usa nelle mappe elettorali spagnole. Ceuta e Melilla sono troppo piccole
per vedersi: la pagina le disegna anche come cerchi.

Scrive dati/mappa.json; strumenti/incorpora.py lo copia dentro index.html.

Uso:  python -I strumenti/mappa.py [percorso/di/provinces.json]
"""
import json
import math
import pathlib
import sys
import urllib.request

URL = 'https://unpkg.com/es-atlas@0.6.0/es/provinces.json'
LAT0 = 40.0
K = 60.0                       # unità SVG per grado di latitudine
CANARIE = (7.0, 6.4)           # spostamento in gradi (lon, lat) del riquadro delle Canarie
CODICI_CANARIE = {'35', '38'}


def carica(percorso):
    if percorso:
        return json.loads(pathlib.Path(percorso).read_text(encoding='utf-8'))
    with urllib.request.urlopen(URL, timeout=60) as r:
        return json.load(r)


def archi(topo):
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']
    out = []
    for a in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in a:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def anello(idx, A):
    pts = []
    for i in idx:
        seg = A[i] if i >= 0 else list(reversed(A[~i]))
        pts.extend(seg if not pts else seg[1:])
    return pts


def main():
    topo = carica(sys.argv[1] if len(sys.argv) > 1 else None)
    A = archi(topo)
    cosl = math.cos(math.radians(LAT0))
    prov = {}
    tutti = []
    for g in topo['objects']['provinces']['geometries']:
        cod = g['id']
        if cod not in {f'{i:02d}' for i in range(1, 53)}:
            continue
        poli = [g['arcs']] if g['type'] == 'Polygon' else g['arcs']
        dl, dt = CANARIE if cod in CODICI_CANARIE else (0, 0)
        anelli = []
        for p in poli:
            for r in p:
                anelli.append([((lon + dl) * cosl * K, -(lat + dt) * K) for lon, lat in anello(r, A)])
        prov[cod] = {'n': g['properties']['name'], 'anelli': anelli}
        tutti.extend(pt for r in anelli for pt in r)
    x0 = min(p[0] for p in tutti) - 8
    y0 = min(p[1] for p in tutti) - 8
    x1 = max(p[0] for p in tutti) + 8
    y1 = max(p[1] for p in tutti) + 8
    out = {'w': round(x1 - x0), 'h': round(y1 - y0), 'p': {}}
    for cod, v in prov.items():
        d = []
        area = 0
        cx = cy = 0
        for r in v['anelli']:
            pts = [(x - x0, y - y0) for x, y in r]
            # baricentro dell'anello più grande, per l'etichetta e per Ceuta e Melilla
            a = 0
            gx = gy = 0
            for (xa, ya), (xb, yb) in zip(pts, pts[1:] + pts[:1]):
                c = xa * yb - xb * ya
                a += c
                gx += (xa + xb) * c
                gy += (ya + yb) * c
            if abs(a) > abs(area) and a:
                area, cx, cy = a, gx / (3 * a), gy / (3 * a)
            d.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z')
        out['p'][cod] = {'n': v['n'], 'd': ''.join(d), 'x': round(cx, 1), 'y': round(cy, 1)}
    # il riquadro delle Canarie
    can = [pt for c in CODICI_CANARIE for r in prov[c]['anelli'] for pt in r]
    out['canarie'] = [round(min(p[0] for p in can) - x0 - 6), round(min(p[1] for p in can) - y0 - 6),
                      round(max(p[0] for p in can) - min(p[0] for p in can) + 12),
                      round(max(p[1] for p in can) - min(p[1] for p in can) + 12)]
    base = pathlib.Path(__file__).resolve().parent.parent
    (base / 'dati').mkdir(exist_ok=True)
    (base / 'dati' / 'mappa.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(out['p']), 'province', out['w'], 'x', out['h'], 'byte', len(json.dumps(out)))


if __name__ == '__main__':
    main()

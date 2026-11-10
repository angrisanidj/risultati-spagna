# risultati-spagna

Dashboard per seguire in diretta lo spoglio delle elezioni generali spagnole di domenica 29 novembre 2026 (Congresso dei deputati). È costruita sulla falsariga di `risultati-israele` e `risultati-brasile`: una sola pagina statica su GitHub Pages che legge i dati del Ministero dell'Interno attraverso un proxy Vercel.

## Cosa c'è

| File | A cosa serve |
|---|---|
| `index.html` | La dashboard, file unico. Base 2023 e confini delle province sono incorporati. |
| `stime.json` | La media dei sondaggi (la scrive il workflow) e gli exit poll in seggi, che si scrivono a mano la sera del voto. |
| `strumenti/sondaggi.py` | Legge i sondaggi da Wikipedia e calcola la media. |
| `condivisione.jpg` | L'anteprima del link sui social (1200×630). |
| `proxy/` | Il progetto Vercel: `api/mir.js` più `lib/normalizza.js`, che traduce il formato del Ministero. |
| `strumenti/base2023.py` | Rifà `dati/base2023.json`, i risultati 2023 per circoscrizione. |
| `strumenti/mappa.py` | Rifà `dati/mappa.json`, i confini delle province già proiettati. |
| `strumenti/incorpora.py` | Copia i due file di `dati/` dentro `index.html`. |
| `dati/comuni2023.json` | Il voto del 2023 negli 8.131 comuni. Si carica solo quando si apre la mappa dei comuni. |
| `dati/comuni-mappa.json` | I confini dei comuni, già proiettati (li scrive `strumenti/mappa.py`). |
| `strumenti/comuni2023.py` | Rifà `dati/comuni2023.json` dal pacchetto ufficiale del Ministero in `strumenti/fonti/`. |
| `.github/workflows/pages.yml` | Pubblica il sito a ogni push su `main`, senza il limite di 10 ricostruzioni l'ora. |

## Cosa mostra

- **Scrutinio, affluenza, primo partito** e la fonte dell'emiciclo.
- **Chi ha la maggioranza:** PP e Vox contro la soglia di 176, con il PSOE e i suoi alleati e i nazionalisti di centro.
- **Voto nazionale:** voti, percentuali, differenza dal 2023, seggi sullo scrutinio, seggi 2023 e una colonna per ogni exit poll.
- **I 350 seggi:** emiciclo con la fonte a scelta (Congresso 2023, exit poll, scrutinio, seggi manuali) e i blocchi secondo ogni fonte.
- **I seggi in bilico:** in ogni circoscrizione l'ultimo seggio assegnato e quanti voti mancano al primo escluso per prenderlo.
- **Simulatore di maggioranza**, con le coalizioni già pronte.
- **La mappa delle province:** primo partito, blocchi, un partito, spostamento di PP e Vox rispetto al 2023, avanzamento dello scrutinio. Toccando una provincia: voti, seggi, ultimo seggio, confronto con il 2023.
- **La mappa dei comuni:** gli 8.131 comuni, con i voti di stanotte man mano che arrivano (livello «Comuni») o quelli del 2023 («Comuni 2023»). Toccando un comune la mappa ingrandisce la sua provincia; la scheda mostra i voti e il confronto con il 2023 nello stesso comune. Si può cercare un comune per nome.
- **Stato dello scrutinio** provincia per provincia.
- **Card per X e Instagram** (modalità redazione): seggi, voto, mappa, seggi in bilico, exit poll.

I seggi si ricalcolano dalla pagina: soglia del 3% dei voti validi (schede bianche comprese) in ogni circoscrizione, poi D'Hondt; a parità di quoziente vince la lista con più voti. I seggi per circoscrizione sono quelli del Real Decreto 806/2026 (BOE del 6 ottobre): rispetto al 2023 Madrid passa da 37 a 38, Cadice da 9 a 8.

Le liste territoriali confluiscono nel partito nazionale (PSC, PSdeG e PSE nel PSOE). Il Frente Amplio è confrontato con Sumar del 2023; Front Valencià (Compromís, Podemos ed EUPV nella Comunità Valenciana) e Adelante Andalucía non hanno un termine di confronto. Il riconoscimento è nella costante `GRUPPI`, in testa allo script: una lista che nessuna regola riconosce compare con la sua sigla, in grigio, fra gli altri partiti. **Quando la Junta electoral proclama le candidature, nei primi giorni di novembre, conviene controllare le sigle** con cui si presentano Frente Amplio, Front Valencià e Podemos nelle varie province: se una non è riconosciuta, va aggiunta la regola.

I blocchi (`BLOCCHI` e il campo `b` di `GRUPPI`):

| Blocco | Partiti |
|---|---|
| PP e Vox | PP, Vox, UPN |
| PSOE e alleati | PSOE, Frente Amplio (l'alleanza che ha preso il posto di Sumar), Podemos, Front Valencià, Adelante Andalucía, ERC, EH Bildu, BNG |
| Nazionalisti di centro | Junts, PNV, Coalizione canaria |
| Altri | tutti gli altri (SALF, CUP, PACMA…) |

## La media dei sondaggi e la proiezione

Fino agli exit poll l'emiciclo e il verdetto mostrano **come potrebbe finire secondo i sondaggi**, e il riquadro omonimo dà i dettagli: media per partito, seggi proiettati con la forchetta, seggi medi stimati dagli istituti, probabilità della maggioranza e l'elenco dei sondaggi usati.

**La media** la calcola `strumenti/sondaggi.py` dalla tabella «2026 (with Broad Front)» di [Opinion polling for the 2026 Spanish general election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Spanish_general_election) e la scrive nel campo `sondaggi` di `stime.json`:
- solo i sondaggi con il campo chiuso nei 21 giorni prima del più recente, uno per istituto (l'ultimo);
- peso che si dimezza ogni 7 giorni e cresce con la radice del campione (fra 0,5 e 2 volte);
- esclusi i sondaggi commissionati dai partiti;
- il PP comprende UPN, come nella tabella; dove Frente Amplio e Front Valencià sono una cifra sola, si toglie la media di Front Valencià.

Il workflow **Media dei sondaggi** (`.github/workflows/sondaggi.yml`) la rifà alle 7:23 e alle 17:23 UTC fino al 28 novembre e fa commit solo se è cambiata; si lancia anche a mano da *Actions → Media dei sondaggi → Run workflow*. Siccome fa commit su `main`, prima di un push a mano conviene un `git pull --rebase`. In locale: `python -I strumenti/sondaggi.py` (con `--prova` stampa senza scrivere).

**La proiezione** si fa nella pagina (`proiezioneSondaggi()`): la media di ogni partito si distribuisce sulle province con il voto del 2023, in proporzione (PSOE, Vox, PP con UPN e i partiti regionali); Frente Amplio e Podemos fuori dalla Comunità Valenciana, Front Valencià solo lì e Adelante Andalucía solo in Andalusia, tutti sulle province dove era forte Sumar; SALF con la stessa quota ovunque. Poi il D'Hondt nelle 52 circoscrizioni con i seggi 2026. Le forchette vengono da 1.000 simulazioni con tre errori: uno comune fra destra e sinistra (2 punti, perché i sondaggi sbagliano spesso tutti dalla stessa parte: nel 2023 il PSOE era sottostimato di circa tre punti), uno per partito e uno per provincia. Al 30 ottobre la proiezione centrale (PP 131, PSOE 108, Vox 68) coincide quasi con la media dei seggi stimati dagli istituti (131, 109, 66).

## I comuni

**Il 2023.** I voti per comune vengono dal pacchetto ufficiale del Ministero `02202307_MUNI.zip` («Área de descargas» di infoelectoral), conservato in `strumenti/fonti/`. Il server di infoelectoral non risponde alla rete della redazione né ai server di GitHub (403): il file è stato scaricato il 10 novembre dal browser integrato di Claude, che invece lo raggiunge. I file sono a lunghezza fissa, descritti nel `FICHEROS.doc` dentro lo zip. Controlli fatti da `strumenti/comuni2023.py`: in tutti gli 8.131 comuni i voti delle liste tornano con il totale; la somma dei comuni è 204.649 voti validi sotto il totale nazionale, cioè il voto dall'estero (CERA), che il Ministero conta solo per provincia.

**I confini** sono quelli dell'IGN nella versione di es-atlas (MIT), proiettati come le province da `strumenti/mappa.py` e salvati con la topologia (archi condivisi), circa 1 MB. I codici INE dei comuni coincidono con quelli del Ministero: 8.131 su 8.131.

**Il disegno.** I comuni sono disegnati su un canvas, non come forme SVG: 8.133 forme SVG erano lente sul telefono (35-50 ms a ogni aggiornamento sul computer, 4-6 volte tanto su un telefono). Ora i colori si calcolano una volta per ogni nuovo dato, la mappa intera si ridisegna in circa 6 ms e una provincia ingrandita in meno di 1 ms; il comune toccato si trova con una griglia di celle in 0,2 ms. Sul telefono: un tocco ingrandisce la provincia e apre il comune nella scheda, subito sotto la mappa; due dita ingrandiscono, un dito sposta la mappa ingrandita, il doppio tocco ingrandisce. Sul computer la rotella ingrandisce e il puntatore mostra il nome del comune.

**La sera del voto** il proxy chiede al Ministero una provincia alla volta con la mappa dei suoi comuni (`?comuni=28`, percorso `MIR_COMUNI`, che nel 2023 era `getScopeData/<provincia>/1/2/1/1/90`: da verificare quando il sito apre). La pagina chiede i comuni solo se un lettore apre il livello «Comuni»: prima la provincia ingrandita, poi le altre, tre alla volta, ogni tre minuti. La cache del proxy tiene ogni provincia 90 secondi, quindi al Ministero arrivano al massimo 52 richieste ogni 90 secondi, comunque vada il traffico. Se i comuni non arrivano, la pagina lo scrive sotto la mappa e il resto funziona come prima.

**La prova generale** (`?prova=2023`) ora rifà lo spoglio comune per comune: dentro ogni provincia arrivano prima i comuni piccoli, con un po' di disordine, e l'ultimo comune del momento è contato in parte. Il vantaggio iniziale del PP nei comuni piccoli si vede da solo. A fine spoglio si aggiunge il voto dall'estero di ogni provincia, e il riparto ridà esattamente i 350 seggi del 2023.

## Da dove arrivano i dati

**Il sito dei risultati del 2026 esiste ma non è ancora aperto.** Nel 2023 il Ministero li pubblicava su `resultados.generales23j.es`, aperto quattro giorni prima del voto, accanto al sito informativo `generales23j.es`. Quest'anno il sito informativo è `29neleccionesgenerales.es`, e dal 10 novembre `resultados.29neleccionesgenerales.es` risponde: è su CloudFront e per ora chiede una password (autenticazione HTTP «Basic», risposta 401), anche sui percorsi `backend-difu`. È la fase di preparazione. Appena si apre, la diagnostica del proxy lo dice.

Il formato è quello del 2023, ricostruito dall'archivio di Wayback Machine: un'API JSON chiamata `backend-difu`, con un file per ambito.

```
backend-difu/scope/data/getScopeData/<scopeId>/1/2/1/0         un ambito (Spagna, provincia, comune)
backend-difu/scope/data/getScopeData/<scopeId>/1/2/1/1/30      la Spagna con le 52 province dentro
backend-difu/nomenclator/getNomenclator?v=…                   l'elenco di tutti gli ambiti
```

Lo scopeId è il codice seguito dal livello, scritto in esadecimale su 24 cifre: la Spagna è `…0b` (codice 1, livello 1), Madrid `…b0e` (codice 28, livello 30). Ogni ambito ha `escrutinio.partidos[]` con sigla, voti e seggi, e la sigla nazionale (`agrupaciones` di livello 1). I dettagli sono in testa a `proxy/lib/normalizza.js`.

Se nel 2026 il Ministero cambia fornitore o formato, va riscritto solo `normalizza.js` (la pagina legge il riassunto del proxy, non il formato del Ministero). Se cambia solo l'indirizzo, bastano le variabili d'ambiente su Vercel, senza toccare il codice:

| Variabile | Predefinito |
|---|---|
| `MIR_BASE` | `https://resultados.29neleccionesgenerales.es/` |
| `MIR_RUTA` | `backend-difu/scope/data/getScopeData/{id}/1/2/1/0` |
| `MIR_MAPA` | `backend-difu/scope/data/getScopeData/{id}/1/2/1/1/30` |
| `MIR_COMUNI` | `backend-difu/scope/data/getScopeData/{id}/1/2/1/1/90` |

**Il canale per i media.** Il Ministero apre un repository di dati riservato ai media accreditati, con i file di avanzamento e scrutinio e un documento che ne descrive il formato. La richiesta andava fatta alla Secretaría de Estado de Comunicación entro il **28 ottobre alle 15**; credenziali il 17 novembre, una connessione per testata. Se una testata con cui lavori è accreditata, quella è la fonte più solida: il proxy si adatta con una funzione nuova in `normalizza.js`.

**I dati 2023** (`dati/base2023.json`) vengono dalle voci «… (Congress of Deputies constituency)» di Wikipedia in inglese, che riportano i risultati definitivi della Junta Electoral Central, voto dall'estero compreso. Il server dei dati storici del Ministero (`infoelectoral.interior.gob.es`) non risponde da fuori Spagna. Il controllo: con le stesse regole della pagina, il riparto dà PP 137, PSOE 121, Vox 33, Sumar 31, ERC 7, Junts 7, EH Bildu 6, PNV 5, BNG 1, CC 1, UPN 1, cioè il risultato ufficiale, provincia per provincia. Nella voce di Cáceres i «Valid votes» hanno una cifra sbagliata; lo script la corregge con la somma di liste e bianche.

## 1. Pubblicare il proxy su Vercel

Il nome del progetto deve essere `spagna-2026-feed-proxy`, così l'indirizzo coincide con quello predefinito nella pagina: `https://spagna-2026-feed-proxy.vercel.app/api/mir`.

```
cd proxy
npx vercel link        # crea il progetto «spagna-2026-feed-proxy»
npx vercel --prod
```

**Il progetto Vercel non deve essere collegato al repository GitHub.** Il 10 novembre lo era (Vercel lo collega da solo al primo `vercel link`): a ogni commit, compresi quelli automatici della media dei sondaggi, ripubblicava la cartella principale, cioè la pagina, al posto del proxy, e `/api/mir` rispondeva 404. È stato scollegato con `npx vercel git disconnect`; il proxy si pubblica solo dalla cartella `proxy/` con `npx vercel --prod`. Se un giorno lo si vuole collegare di nuovo, va impostata **Root Directory = `proxy`** nelle impostazioni del progetto. La funzione gira a Parigi (`cdg1`, in `vercel.json`: Vercel non ha una regione in Spagna). Le richieste ammesse arrivano da `https://angrisanidj.github.io` e da `localhost`; per altri domini modifica `ORIGINI` in `api/mir.js`.

Il proxy prova prima la Spagna con le province dentro (una richiesta); se la risposta non le contiene tutte, chiede le 52 province, 6 alla volta. La cache del CDN di Vercel tiene ogni risposta 20 secondi, quindi molti lettori aperti producono al massimo un giro di richieste al Ministero ogni 20 secondi. Dopo un 429 o un 403 il proxy si ferma un minuto.

### Diagnostica, appena il sito dei risultati esiste e poi il giorno prima

```
https://spagna-2026-feed-proxy.vercel.app/api/mir?diag=1
https://spagna-2026-feed-proxy.vercel.app/api/mir?grezzo=28
```

La diagnostica prova la Spagna con le province, la Spagna da sola e Madrid: stato HTTP, latenza, intestazioni anti-bot (`waf`) e un riassunto (province trovate, seggi elettorali, voti validi). `?grezzo=28` restituisce Madrid così come la pubblica il Ministero (`1` per la Spagna), utile per controllare il formato.

| Esito | Significato |
|---|---|
| 200 con un riassunto | La catena funziona. Prima del voto i voti sono zero. |
| 404 o errore DNS | Il sito non c'è ancora, o ha un altro indirizzo: imposta `MIR_BASE`. |
| 200 con `riassunto: null` | Il formato è cambiato: guarda `inizio` e `?grezzo=1`, poi adatta `normalizza.js`. |
| 403, o 202 con `waf` | Blocco anti-bot verso Vercel, come in Israele: vedi «Se il feed si blocca». |

## 2. Pubblicare la pagina

Crea il repository `angrisanidj/risultati-spagna` e carica tutto (`proxy/` non dà fastidio). Poi passa GitHub Pages alla pubblicazione con il workflow, una volta:

```
gh api -X POST repos/angrisanidj/risultati-spagna/pages -f build_type=workflow
```

La pagina va aperta da un server (GitHub Pages o `python -m http.server`): dal disco funziona, ma senza `stime.json`.

## 3. La prova generale

- **`…/risultati-spagna/?prova=2023`** simula una notte di spoglio con i risultati veri del 2023. Ogni circoscrizione ha un suo ritmo (le grandi più lente) e i primi seggi contati sono più a destra della media, come nelle notti vere: si vede il vantaggio iniziale del PP restringersi. Al 100% il riparto deve dare il risultato ufficiale. «Nuova simulazione» cambia l'ordine di arrivo.
- **`?feed=1`** accende subito il feed (senza, la pagina non chiama il proxy fino a domenica 29 novembre alle 19:30, poi si accende da sola).
- **`?proxy=https://…`** sostituisce il proxy predefinito.
- **`?copia=1`** legge solo la copia in `dati/live/escrutinio.json`, senza proxy.

## La sera del voto

**Orari:** i seggi chiudono alle **20**, la stessa ora in Italia; alle Canarie alle 20 locali, cioè le 21. Gli exit poll escono alle 20. Il voto degli spagnoli residenti all'estero (CERA) si conta il mercoledì successivo e può spostare qualche ultimo seggio: nel 2023 ha tolto un seggio di Madrid al PSOE per darlo al PP.

### Exit poll

Si scrivono in `stime.json`, in seggi, per partito. Un numero o una forchetta `[min, max]`: la pagina mostra il valore centrale e la forchetta sotto.

```json
{
  "aggiornato": "29 novembre 2026, 20:02",
  "exit": {
    "rtve": { "n": "RTVE · Sigma Dos", "s": "RTVE", "ora": "20:00",
              "seggi": { "PP": [140, 145], "PSOE": [110, 115], "VOX": [30, 33], "FA": [8, 11], "ERC": 7, "JUNTS": 7 } },
    "gad3": { "n": "GAD3 · Mediaset", "s": "GAD3", "ora": "20:00", "seggi": { "PP": 148, "PSOE": 112 } }
  }
}
```

- `n` è il nome lungo (istituto e rete), `s` quello breve per le colonne, `ora` l'ora di pubblicazione.
- Le chiavi dei partiti sono quelle di `GRUPPI`: `PP`, `PSOE`, `VOX`, `FA` (Frente Amplio), `FV` (Front Valencià), `PODEMOS`, `AA` (Adelante Andalucía), `ERC`, `JUNTS`, `BILDU`, `PNV`, `BNG`, `CC`, `UPN`, `SALF`, `CUP`, `NC`, `TE`, `UPL`, `SY`, `PACMA`. Una chiave sconosciuta compare con il suo nome fra gli altri partiti.
- L'ordine degli exit poll nel file è l'ordine delle colonne; in automatico l'emiciclo usa la proiezione dei sondaggi fino al primo exit poll, quello fino al 40% dello scrutinio, poi i voti contati.
- Il campo `sondaggi` lo scrive il workflow: quando si modifica `stime.json` a mano va lasciato com'è.
- La pagina rilegge `stime.json` ogni 15 secondi fra le 19:55 e le 22 italiane, ogni due minuti il resto del tempo.

La via più rapida è la stessa di Israele: gli screenshot dei grafici delle reti a Claude, che scrive `stime.json`, fa commit e push e aspetta Pages. Le reti aggiornano le stime nella notte: si ripete con la nuova ora.

### Modalità redazione

La stessa chiave delle dashboard di Israele e Brasile: `?redazione=CHIAVE` una volta (il browser la ricorda, `?redazione=esci` la dimentica). Compaiono:
- «Aggiorna ora» e «Metti in pausa» del feed;
- **Importa file**: i JSON del Ministero scaricati a mano dal sito dei risultati (anche la Spagna e più province insieme), oppure il riassunto del proxy; il feed va in pausa;
- **Inserimento manuale**: i seggi nazionali come li mostra il sito del Ministero, se il feed si ferma; valgono finché non li rimuovi;
- la scheda **Card per X**.

### Se il feed si blocca

- **Il Ministero blocca Vercel** (anti-bot, come a Israele): scarica dal browser il file della Spagna con le province e importalo con «Importa file». Per tutti i lettori, si pubblica il riassunto in `dati/live/escrutinio.json`: la pagina lo legge da sola quando il proxy non risponde. Lo script che lo fa a ogni download (come `pubblica-feed.mjs` per Israele) non c'è ancora: conviene scriverlo appena si conosce il sito vero.
- **Il Ministero non risponde per nessuno:** l'inserimento manuale dei seggi.

## Condivisione

- **Pulsanti per i lettori:** X, Threads, Facebook, LinkedIn, Telegram, WhatsApp e il link. Il testo segue i dati: prima del voto presenta la pagina, poi riporta i seggi di PP e Vox e del PSOE con gli alleati secondo la fonte dell'emiciclo. Icone da [Bootstrap Icons](https://icons.getbootstrap.com) (MIT).
- **Anteprima del link:** `condivisione.jpg`, 1200×630, con l'emiciclo del Congresso uscente.
- **Card per X e Instagram:** cinque card (seggi, voto, mappa, seggi in bilico, exit poll) in 16:9 o 4:5, con titolo e testo del post che si rigenerano da soli finché non li modifichi. Scarica PNG, Condividi (menu del sistema con immagine e testo), Pubblica su X (l'immagine si allega a mano).

## Fonti e licenze

- Voti: Ministero dell'Interno, dati provvisori.
- Seggi per circoscrizione: Real Decreto 806/2026, BOE-A-2026-20742.
- Base 2023: Junta Electoral Central, tramite le voci di Wikipedia in inglese sulle circoscrizioni (CC BY-SA).
- Sondaggi: la tabella di Wikipedia in inglese (CC BY-SA), con gli istituti e i committenti indicati sulla pagina.
- Confini delle province: Istituto geografico nazionale (IGN), nella versione TopoJSON di [es-atlas](https://github.com/martgnz/es-atlas) 0.6.0 (MIT), proiettati da `strumenti/mappa.py`; le Canarie spostate in un riquadro.

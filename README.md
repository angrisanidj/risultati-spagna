# risultati-spagna

Dashboard per seguire in diretta lo spoglio delle elezioni generali spagnole di domenica 29 novembre 2026 (Congresso dei deputati e Senato). È costruita sulla falsariga di `risultati-israele` e `risultati-brasile`: una sola pagina statica su GitHub Pages che legge i dati del Ministero dell'Interno attraverso un proxy Vercel.

## Cosa c'è

| File | A cosa serve |
|---|---|
| `index.html` | La dashboard, file unico. Base 2023 e confini delle province sono incorporati. |
| `stime.json` | La media dei sondaggi (la scrive il workflow) e gli exit poll in seggi, che si scrivono a mano la sera del voto. |
| `strumenti/sondaggi.py` | Legge i sondaggi da Wikipedia e calcola la media. |
| `condivisione.jpg` | L'anteprima del link sui social (1200×630). |
| `bandiera.svg` | La bandiera ufficiale, con lo stemma: icona in alto, icona della scheda del browser e sfondo dell'intestazione. |
| `proxy/` | Il progetto Vercel: `api/mir.js` più `lib/normalizza.js`, che traduce il formato del Ministero. |
| `strumenti/base2023.py` | Rifà `dati/base2023.json`, i risultati 2023 per circoscrizione. |
| `strumenti/mappa.py` | Rifà `dati/mappa.json`, i confini delle province già proiettati. |
| `strumenti/incorpora.py` | Copia i due file di `dati/` dentro `index.html`. |
| `dati/comuni2023.json` | Il voto del 2023 negli 8.131 comuni. Si carica solo quando si apre la mappa dei comuni. |
| `dati/senato2023.json` | I senatori del 2023 collegio per collegio, con i voti dei candidati: base della scheda del Senato. |
| `dati/comuni-mappa.json` | I confini dei comuni, già proiettati (li scrive `strumenti/mappa.py`). |
| `strumenti/comuni.py` | Legge i pacchetti ufficiali del Ministero per comune (`strumenti/fonti/`): rifà `dati/comuni2023.json` e i file del backtest. |
| `proxy/lib/modello.js` | La proiezione dello spoglio, usata dalla pagina (in un Web Worker, `proxy/lib/lavoratore.js`) e dal backtest. |
| `strumenti/backtest/` | I backtest della proiezione dello spoglio e della media dei sondaggi, con i dati e i risultati. |
| `.github/workflows/pages.yml` | Pubblica il sito a ogni push su `main`, senza il limite di 10 ricostruzioni l'ora. |

## Cosa mostra

- **Scrutinio, affluenza, primo partito** e la fonte dell'emiciclo.
- **Chi ha la maggioranza:** PP e Vox contro la soglia di 176, con il PSOE e i suoi alleati e i nazionalisti di centro.
- **Come finirà lo spoglio:** la proiezione del risultato finale dai comuni già contati, con le forchette e la probabilità della maggioranza (vedi «La proiezione dello spoglio»).
- **Voto nazionale:** voti, percentuali, differenza dal 2023, seggi sullo scrutinio, seggi 2023 e una colonna per ogni exit poll.
- **I 350 seggi:** emiciclo con la fonte a scelta (Congresso 2023, exit poll, scrutinio, seggi manuali) e i blocchi secondo ogni fonte.
- **I seggi in bilico:** in ogni circoscrizione l'ultimo seggio assegnato e quanti voti mancano al primo escluso per prenderlo.
- **Simulatore di maggioranza**, con le coalizioni già pronte.
- **Il Senato:** i 209 senatori eletti per partito con il confronto con il 2023, i seggi più contesi e, in una tendina, i 60 collegi con eletti, voti e margine; filtro per i collegi dell'accordo PP-Vox (vedi «Il Senato»).
- **La mappa delle province:** primo partito, blocchi, un partito, spostamento di PP e Vox rispetto al 2023, avanzamento dello scrutinio. Toccando una provincia: voti, seggi, ultimo seggio, confronto con il 2023.
- **La mappa dei comuni:** gli 8.131 comuni, con i voti di stanotte man mano che arrivano (livello «Comuni») o quelli del 2023 («Comuni 2023»). Toccando un comune la mappa ingrandisce la sua provincia; la scheda mostra i voti e il confronto con il 2023 nello stesso comune. Si può cercare un comune per nome. Nella legenda «Il primo partito» ogni partito è un filtro: un tocco lascia accese solo le province o i comuni dove è primo, un secondo tocco (o «Mostra tutti») torna alla mappa completa.
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

**Il 2023.** I voti per comune vengono dal pacchetto ufficiale del Ministero `02202307_MUNI.zip` («Área de descargas» di infoelectoral), conservato in `strumenti/fonti/`. Il server di infoelectoral non risponde alla rete della redazione né ai server di GitHub (403): il file è stato scaricato il 10 novembre dal browser integrato di Claude, che invece lo raggiunge. I file sono a lunghezza fissa, descritti nel `FICHEROS.doc` dentro lo zip. Controlli fatti da `strumenti/comuni.py`: in tutti gli 8.131 comuni i voti delle liste tornano con il totale; la somma dei comuni è 204.649 voti validi sotto il totale nazionale, cioè il voto dall'estero (CERA), che il Ministero conta solo per provincia.

**I confini** sono quelli dell'IGN nella versione di es-atlas (MIT), proiettati come le province da `strumenti/mappa.py` e salvati con la topologia (archi condivisi), circa 1 MB. I codici INE dei comuni coincidono con quelli del Ministero: 8.131 su 8.131.

**Il disegno.** I comuni sono disegnati su un canvas, non come forme SVG: 8.133 forme SVG erano lente sul telefono (35-50 ms a ogni aggiornamento sul computer, 4-6 volte tanto su un telefono). Ora i colori si calcolano una volta per ogni nuovo dato, la mappa intera si ridisegna in circa 6 ms e una provincia ingrandita in meno di 1 ms; il comune toccato si trova con una griglia di celle in 0,2 ms. Sul telefono: un tocco ingrandisce la provincia e apre il comune nella scheda, subito sotto la mappa; due dita ingrandiscono, un dito sposta la mappa ingrandita, il doppio tocco ingrandisce. Sul computer la rotella ingrandisce e il puntatore mostra il nome del comune.

**La sera del voto** il proxy chiede al Ministero le 52 province, ognuna con la mappa dei suoi comuni (percorso `MIR_COMUNI`, che nel 2023 era `getScopeData/<provincia>/1/2/1/1/90`: da verificare quando il sito apre), e le restituisce in una risposta sola (`?comuni=tutti`). La pagina la chiede ogni due minuti dai primi voti contati: serve alla mappa dei comuni e alla proiezione dello spoglio. La cache del proxy tiene la risposta 90 secondi, quindi al Ministero arrivano al massimo 52 richieste ogni 90 secondi, comunque vada il traffico. Se i comuni non arrivano, la pagina lo scrive sotto la mappa e il resto funziona come prima; `?comuni=28` restituisce una provincia sola, per controllo.

**La prova generale** (`?prova=2023`) ora rifà lo spoglio comune per comune: dentro ogni provincia arrivano prima i comuni piccoli, con un po' di disordine, e l'ultimo comune del momento è contato in parte. Il vantaggio iniziale del PP nei comuni piccoli si vede da solo. A fine spoglio si aggiunge il voto dall'estero di ogni provincia, e il riparto ridà esattamente i 350 seggi del 2023.

## Il Senato

Si vota anche per il Senato, con una scheda a parte. I senatori eletti sono **209** in **60 collegi**: 4 per provincia, 3 a Mallorca, Gran Canaria e Tenerife, 1 in ciascuna delle altre isole, 2 a Ceuta e 2 a Melilla. Dal 2026 Formentera elegge un senatore suo, separata da Eivissa (riforma dell'articolo 69.3 della Costituzione, sancita a maggio 2026, e Ley Orgánica 2/2026 sulla legge elettorale): nel 2023 i collegi erano 59 e gli eletti 208. Il voto è limitato (3 preferenze dove si eleggono 4 senatori, 2 dove 3, una dove 1 o 2) e sono eletti i candidati più votati. I senatori designati dai parlamenti delle comunità autonome non si votano alle generali e la pagina non li conta.

**Nella pagina** c'è una scheda «Il Senato» prima della mappa, compatta: una barra con i senatori eletti o in testa per partito e, sotto, ogni partito con la differenza dal 2023 (prima dei voti, gli eletti del 2023); poi, solo con i voti, i quattro seggi più contesi, cioè dove la sfida più stretta fra un escluso e l'ultimo eletto di un altro partito si decide per meno voti. Tutti i collegi sono in una tendina chiusa, una riga ciascuno con gli eletti in pallini e il margine; toccando una riga si aprono nomi, voti, scrutinio ed esito del 2023, e la riga resta aperta agli aggiornamenti. Il filtro «Accordo PP-Vox» lascia i collegi toccati dall'accordo del 26 ottobre 2026: Vox non presenta candidati a Valencia, Castellón, Cádiz, nelle Baleari, a Las Palmas e a Santa Cruz de Tenerife (nelle liste del PP c'è un indipendente indicato da Vox); il PP non si presenta a Gipuzkoa, Girona e Tarragona. Nel dettaglio di ogni provincia, sotto la mappa, c'è anche il suo risultato al Senato.

**I gruppi.** Le candidature del Senato passano per le stesse regole del Congresso, con due eccezioni: «Sa Unió de Formentera» (PP e Compromís di Formentera) va al PP e non al Front Valencià; le coalizioni «Senado de Progreso» (PSOE e Movimiento Sumar, in alcune province) hanno un gruppo loro, nel blocco della sinistra.

**Il 2023** è in `dati/senato2023.json`: per ogni collegio nome, senatori, voti validi e i candidati con candidatura, voti ed esito (il nome solo per gli eletti). Viene dal pacchetto ufficiale del Ministero `03202307_MUNI.zip` (file 03, 04, 07 e 08), scaricato il 11 novembre dal browser integrato e letto lì: il file JSON è uscito dal browser, lo zip no. Controlli: 59 collegi, 208 eletti, PP 120; la prova generale a spoglio completo rielegge gli stessi senatori in tutti i 59 collegi.

**La sera del voto** il proxy risponde a `?senato=1` con quattro richieste al Ministero: la Spagna con le province dentro (`MIR_SENATO`) e le tre province con le isole (`MIR_SENATO_ISOLE`, livello 70), con 30 secondi di cache. La pagina la chiede al massimo una volta al minuto, dopo ogni aggiornamento del Congresso. **Il percorso del Senato non si è potuto verificare**: nel 2023 il sito dei risultati lo chiedeva con `2/3` al posto di `1/2`, e non è certo che il Ministero pubblichi i voti dei singoli candidati nello stesso file. `normalizza.js` legge i campi più probabili (`candidatos`, con `nombre`, `votos`, `electo`); se mancano usa i senatori per candidatura (`cargos`). Appena il sito apre va controllato con `?grezzo` e, se serve, si cambiano le variabili su Vercel. Se il Senato non arriva, la scheda lo scrive in fondo e il Congresso funziona come prima.

**La prova generale** rifà anche il Senato: i voti dei candidati del 2023, nella parte contata della loro provincia, con un po' di rumore finché lo spoglio non finisce.

## La proiezione dello spoglio

Durante lo spoglio il riquadro **Come finirà lo spoglio** stima il risultato finale del conteggio a partire dai comuni già contati.

**Quando si vede** (le soglie vengono dal backtest qui sotto, e sono sulla quota di seggi elettorali scrutinati che pubblica il Ministero):
- **sotto il 5%, mai:** l'errore è di una ventina di seggi e la forchetta all'80% contiene il risultato vero solo 3 volte su 4;
- **dal 5%, il riquadro:** la forchetta è calibrata e su PP+Vox l'errore medio è di 1-3 seggi;
- **dal 10%, anche l'emiciclo e il titolo principale,** se il controllo sull'ordine di arrivo è superato: prima la divisione fra i singoli partiti sbaglia ancora di 12-17 seggi; dal 97% tornano i voti contati;
- **solo con i dati dei comuni:** in ogni provincia dove il Ministero ha contato qualcosa, i comuni ricevuti devono coprire almeno l'85% dei seggi elettorali che il Ministero dà per scrutinati. Se mancano province o i comuni restano indietro, la proiezione non si vede; in modalità redazione il riquadro dello scrutinio dice perché.

**Il controllo sull'ordine di arrivo.** Il backtest prova ordini di arrivo simulati; quello vero di stanotte può essere diverso. A ogni aggiornamento il modello si mette alla prova da solo: con gli stessi comuni contati finora, nella stessa misura, rifà la proiezione da novembre 2019 al 2023, di cui conosce il risultato. Se così sbaglia più del doppio di quanto sbagliava in media nel backtest allo stesso punto dello spoglio (in seggi spostati, o 2,5 volte su PP+Vox, con un minimo di 3 seggi), il riquadro avverte in giallo che con quest'ordine di arrivo la proiezione è meno affidabile, e la proiezione non va nei titoli. Altrimenti il riquadro lo dice in verde. Il controllo è in `proxy/lib/lavoratore.js`, le soglie in `BACKTEST` nella pagina.

**Il problema.** In Spagna arrivano prima i comuni piccoli, più a destra della media, e le grandi città per ultime. Il riparto sui voti contati, quello che mostra il Ministero, all'inizio sbaglia di molto: con il 2% dello spoglio di decine di seggi.

**Il metodo** (`proxy/lib/modello.js`, usato dalla pagina in un Web Worker e dal backtest):
- ogni comune contato si confronta con se stesso all'elezione precedente (per il 2026 il 2023), per famiglie di partiti che esistono in entrambe (Sumar 2023 è la famiglia di Frente Amplio, Podemos, Front Valencià e Adelante Andalucía; PP e UPN stanno insieme; le bianche sono una famiglia a sé);
- per ogni famiglia si misura il rapporto fra i voti presi e quelli attesi con le quote della volta precedente, nella stessa provincia e nella stessa classe di dimensione dei comuni; dove i comuni contati sono pochi la stima si avvicina a quella della provincia e poi a quella nazionale della stessa classe;
- un partito che la volta precedente non c'era (SALF) prende la quota osservata nei comuni contati della stessa provincia e classe;
- i comuni non contati votano come la volta precedente, corretti da quei rapporti e dall'affluenza stimata allo stesso modo; un comune contato in parte vota, nella parte che manca, come nella parte contata;
- poi il D'Hondt in ogni circoscrizione. L'incertezza viene da 400 simulazioni con un errore per famiglia comune a tutto il paese e uno per provincia, più largo dove si è contato poco.

Il voto dall'estero (CERA) non entra: si conta giorni dopo. La proiezione stima il conteggio della notte, cioè il 100% del Ministero.

**I dati.** La sera del voto la pagina chiede al proxy tutti i comuni insieme (`?comuni=tutti`) ogni due minuti, dai primi voti contati. Servono sia alla proiezione sia alla mappa dei comuni.

### Il backtest dello spoglio

`node strumenti/backtest/backtest.mjs 30` rifà lo spoglio di due elezioni vere partendo da quella precedente, con i dati ufficiali per comune (`strumenti/fonti/`, i 2019 dal repository JaimeObregon/infoelectoral che conserva i file del Ministero): aprile 2019 → novembre 2019 e novembre 2019 → luglio 2023. Per ognuna 30 notti simulate, con l'ordine di arrivo della prova generale (prima i comuni piccoli, ogni provincia con il suo ritmo); per il 2023 anche 30 notti con un ordine del tutto casuale. A ogni punto si confronta con il risultato finale del conteggio. «Seggi spostati» è la metà della somma degli scarti fra partiti; la forchetta è quella all'80%. I risultati completi sono in `strumenti/backtest/risultati.txt`.

| Spoglio | Apr→nov 2019: grezzo | modello | forchetta 80% | Nov 2019→2023: grezzo | modello | forchetta 80% |
|---|---|---|---|---|---|---|
| 2% | 90,8 | 21,8 | 75% | 91,3 | 18,8 | 73% |
| 5% | 49,4 | 17,2 | 81% | 49,2 | 11,9 | 81% |
| 10% | 26,7 | 11,5 | 88% | 18,9 | 7,1 | 87% |
| 20% | 12,7 | 5,4 | 97% | 10,9 | 4,5 | 91% |
| 30% | 8,6 | 3,1 | 99% | 8,2 | 3,1 | 92% |
| 50% | 4,7 | 1,9 | 100% | 5,3 | 2,3 | 94% |
| 80% | 2,6 | 0,7 | 100% | 2,2 | 0,6 | 99% |

Seggi spostati in media su 30 notti; «forchetta» è la quota di partiti il cui risultato vero cade nella forchetta all'80%. Sulla somma di PP e Vox, con il 5% contato, il riparto grezzo sbagliava in media di 27-39 seggi, la proiezione di 1-3; con il 10%, 4-7 contro 2.

Con un ordine di arrivo del tutto casuale (2023, 30 notti) la proiezione fa anche meglio: 11,2 seggi spostati con il 2% contro 87,6 del riparto grezzo, 3,7 con il 10% contro 11,3, forchetta all'80% fra il 77% e il 100%.

La proiezione batte sempre il riparto sui voti contati, e di molto all'inizio. La forchetta all'80% contiene il risultato vero circa 3 volte su 4 nei primissimi minuti e quasi sempre dopo il 20%: all'inizio è un po' stretta, dopo è prudente. Il backtest non può provare un ordine di arrivo molto diverso da quelli simulati, né un'elezione molto diversa dalla precedente: in quei casi l'errore iniziale sarà più alto.

### Il backtest della media dei sondaggi

`python -I strumenti/backtest/sondaggi2023.py` rifà la media dei sondaggi come sarebbe stata il 17 luglio 2023, ultimo giorno in cui si potevano pubblicare, con lo stesso codice di `strumenti/sondaggi.py` (26 istituti); `node strumenti/backtest/sondaggi2023.mjs` la proietta in seggi con le regole della pagina, partendo da novembre 2019.

| | PP | PSOE | Vox | Sumar | PP+Vox+UPN |
|---|---|---|---|---|---|
| Media dei sondaggi, voti | 33,9% | 28,3% | 13,2% | 13,4% | |
| Risultato, voti | 33,1% | 31,7% | 12,4% | 12,3% | |
| Proiezione della media, seggi | 140 (122–152) | 104 (95–125) | 38 (29–44) | 36 (28–42) | 181 (159–193) |
| Seggi medi stimati dagli istituti | 143 | 109 | 34 | 33 | |
| Risultato, seggi | 137 | 121 | 33 | 31 | 171 |

La proiezione avrebbe dato a PP e Vox la maggioranza in 56 simulazioni su 100; finirono a 171, dentro la forchetta, come 10 partiti su 11 (fuori UPN, per come Navarra Suma del 2019 è stata attribuita). L'errore viene soprattutto dai sondaggi, che sottostimavano il PSOE di 3,4 punti: date alla stessa proiezione le percentuali vere del 2023, i seggi spostati scendono da 19 a 6 (PP 134, PSOE 124, Vox 31, Sumar 30). La traduzione da voti a seggi regge; l'incertezza vera è quella dei sondaggi, e per questo la forchetta tiene conto di un errore comune fra destra e sinistra.

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
| `MIR_SENATO` | `backend-difu/scope/data/getScopeData/{id}/2/3/1/1/30` (da verificare) |
| `MIR_SENATO_ISOLE` | `backend-difu/scope/data/getScopeData/{id}/2/3/1/1/70` (da verificare) |

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
- L'ordine degli exit poll nel file è l'ordine delle colonne; in automatico l'emiciclo usa la proiezione dei sondaggi fino al primo exit poll, gli exit poll fino al 10% dello scrutinio, poi la proiezione dello spoglio (se ha superato il controllo sull'ordine di arrivo; altrimenti i voti contati dal 40%) e, dal 97%, i voti contati.
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

- Bandiera: «Flag of Spain.svg» di Wikimedia Commons, pubblico dominio, disegnata secondo il Real Decreto 441/1981 (stemma compreso); aggiunto solo il `viewBox` perché si ridimensioni.

- Voti: Ministero dell'Interno, dati provvisori.
- Seggi per circoscrizione: Real Decreto 806/2026, BOE-A-2026-20742.
- Senato 2023: Ministero dell'Interno, `03202307_MUNI.zip` (infoelectoral). Candidature del Senato 2026 e accordo PP-Vox: BOE delle candidature proclamate e le agenzie del 26 ottobre 2026.
- Base 2023: Junta Electoral Central, tramite le voci di Wikipedia in inglese sulle circoscrizioni (CC BY-SA).
- Sondaggi: la tabella di Wikipedia in inglese (CC BY-SA), con gli istituti e i committenti indicati sulla pagina.
- Confini delle province: Istituto geografico nazionale (IGN), nella versione TopoJSON di [es-atlas](https://github.com/martgnz/es-atlas) 0.6.0 (MIT), proiettati da `strumenti/mappa.py`; le Canarie spostate in un riquadro.

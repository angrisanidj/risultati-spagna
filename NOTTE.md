# La notte del 29 novembre

La scaletta per la sera del voto: cosa succede, a che ora, cosa guardare e cosa fare se qualcosa si rompe. Tutti gli orari sono italiani, che sono anche quelli della Spagna peninsulare. I dettagli tecnici sono nel [README](README.md).

## Da tenere aperti

| Cosa | Indirizzo |
|---|---|
| La pagina, come la vedono i lettori | https://angrisanidj.github.io/risultati-spagna/ |
| La pagina in redazione | la stessa con `?redazione=CHIAVE` (il browser la ricorda: va aperta una volta su computer e telefono **prima** della sera) |
| La diagnostica del proxy | https://spagna-2026-feed-proxy.vercel.app/api/mir?diag=1 |
| Il sito del Ministero | https://resultados.29neleccionesgenerales.es/ |
| Il registratore della notte | https://github.com/angrisanidj/risultati-spagna/actions/workflows/notte.yml |
| La pubblicazione del sito | https://github.com/angrisanidj/risultati-spagna/actions/workflows/pages.yml |

## Prima della sera (venerdì 27 o sabato 28)

- [ ] **La diagnostica dà 200 con un riassunto** (province 52, voti a zero). Se non è così, vedi «Se qualcosa va storto».
- [ ] **`stime.json` ha `exit` vuoto** e la media dei sondaggi aggiornata: il workflow «Media dei sondaggi» scrive l'ultima volta sabato 28.
- [ ] **Il workflow «Storia della notte» è attivo** (nella pagina di Actions non c'è la scritta «This workflow was disabled»).
- [ ] **La chiave della redazione** è già nel browser del computer e del telefono: in alto deve comparire «Aggiorna ora».
- [ ] **Una card di prova** scaricata dal telefono, per controllare che il menu Condividi funzioni.
- [ ] **Claude ha accesso al repository** nella sessione della notte: gli exit poll passano da lì.

## La sera, ora per ora

| Ora | Cosa succede | Cosa guardare |
|---|---|---|
| 19:00 | Niente di automatico | Apri le pagine dell'elenco. La diagnostica deve dare 200. |
| 19:17 | Parte il registratore della notte (GitHub Actions), con la riserva degli exit poll | Verso le 19:20, nella pagina del workflow c'è un giro in corso, giallo, con due lavori: «registra» ed «exit». **Se alle 19:50 non c'è**, vedi sotto. |
| 19:30 | La pagina accende il feed da sola | La riga di stato passa da «Aggiornamento automatico spento…» a «Collegato · il Ministero non ha ancora voti contati». |
| 19:55 | La pagina rilegge `stime.json` ogni 15 secondi (fino alle 22) | — |
| 20:00 | Chiudono i seggi nella penisola. **Escono gli exit poll** | Screenshot dei grafici delle reti a Claude, che scrive `stime.json`, fa commit e push. Dopo un paio di minuti (pubblicazione di Pages) compaiono le colonne nella tabella del voto e l'emiciclo passa agli exit poll. In redazione, la card «Exit poll». **La riserva:** se gli screenshot non arrivano, dalle 20:20 circa gli exit poll compaiono da soli, letti da Wikipedia (nel 2023 il primo è arrivato alle 20:21, gli altri entro le 21:15). |
| 21:00 | Chiudono i seggi alle Canarie | — |
| primi dati | Il Ministero pubblica lo scrutinio | Riga di stato: «In diretta · Ministero HH:MM · scrutinio X%». Arrivano la mappa dei comuni e il grafico «La forchetta che si stringe» (prima solo la linea gialla dei voti contati). |
| 10% | **Compare la proiezione dello spoglio** | Il riquadro «Come finirà lo spoglio», le linee della proiezione sotto la barra della maggioranza, la linea chiara nel grafico della forchetta. Se non compare, in redazione il riquadro dello scrutinio dice perché. L'emiciclo passa dagli exit poll alla proiezione, se ha superato il controllo sull'ordine di arrivo. |
| 80% | **Compaiono i flussi elettorali** | «Da dove vengono i voti». Servono i comuni completi per almeno il 60% degli elettori: a volte arrivano qualche minuto dopo. |
| 97% | L'emiciclo passa ai voti contati | — |
| fine spoglio | Il registratore si ferma da solo | Il giro nella pagina del workflow diventa verde. |

Le reti aggiornano gli exit poll durante la notte: si ripete con l'ora nuova (`ora` in `stime.json`).

Fino alle 22:30 il lavoro «exit» fa commit su `main` a ogni novità di Wikipedia: **prima di ogni push a mano, `git pull --rebase`**. Gli exit poll inseriti a mano non li tocca, e se un istituto c'è già a mano salta la sua riga di Wikipedia.

## Se qualcosa va storto

| Cosa si vede | Cosa vuol dire | Cosa fare |
|---|---|---|
| Riga di stato rossa: «Dati del Ministero non raggiungibili (…)» | Il proxy non riceve i dati | Apri la diagnostica e guarda lo `stato` delle prove: le righe sotto. |
| Diagnostica: 403, oppure `waf` valorizzato | Il Ministero blocca Vercel, come a Israele | Per te: scarica dal sito del Ministero il file della Spagna con le province e caricalo con **Importa file** (redazione). Per i lettori serve la copia in `dati/live/escrutinio.json`: **lo script che la pubblica non c'è ancora**, si scrive quando apre il sito del Ministero. |
| Diagnostica: 404 o errore DNS | Il sito ha un altro indirizzo o un altro percorso | Variabile `MIR_BASE` (o `MIR_RUTA`, `MIR_MAPA`…) su Vercel, poi di nuovo `npx vercel --prod` da `proxy/`: le variabili valgono solo dalla pubblicazione successiva. |
| Diagnostica: 200 ma `riassunto: null` | Il Ministero ha cambiato formato | Claude adatta `proxy/lib/normalizza.js` guardando `?grezzo=1`, poi `npx vercel --prod`. |
| «Il Ministero ha limitato le richieste: pausa di un minuto» | Il Ministero ha risposto 429 o 403 | Niente: il proxy si ferma da solo e riprova. Se dura più di dieci minuti, è un blocco: riga sopra. |
| Il proxy non risponde per nessuno, il Ministero sì | Vercel è giù | **Inserimento manuale** dei seggi nazionali (redazione), copiandoli dal sito del Ministero. Valgono finché non li togli. |
| Dopo il 10% la proiezione non compare | Mancano i comuni di qualche provincia | In redazione il riquadro dello scrutinio elenca le province scoperte. Di solito si sistema al giro dei comuni dopo (ogni due minuti). Non c'è niente da forzare. |
| La proiezione c'è ma con l'avviso sull'ordine di arrivo | Il controllo sul 2019→2023 sbaglia troppo con i comuni contati finora | È voluto: la proiezione resta nel riquadro ma non va nei titoli né nell'emiciclo. Nei post usare i voti contati. |
| Alle 19:50 il registratore non è partito | GitHub ha saltato tutti e due gli orari | Nella pagina del workflow: **Run workflow**, modo **notte**. Oppure da terminale: `gh workflow run notte.yml -f modo=notte`. |
| Il registratore si ferma a metà notte (giro rosso) | Errore nel browser senza schermo | Rilancialo come sopra: tiene i punti già pubblicati e aggiunge i suoi. Ai lettori che hanno la pagina aperta non cambia niente. |
| Gli exit poll non compaiono dopo il push | Pages non ha ancora pubblicato | Guarda la pagina «Pubblica il sito»: se il giro è rosso, rilancialo (Run workflow). Un push nuovo annulla quello in corso: inutile spingerne tre di fila. |
| Un exit poll è sbagliato | — | Si corregge `stime.json` e si fa un altro push. Il campo `sondaggi` non si tocca. |
| Un exit poll arrivato da Wikipedia è sbagliato | Una modifica sbagliata o vandalica della tabella | Si inserisce a mano lo stesso istituto, con i numeri giusti: da lì la riga di Wikipedia si salta. Le voci da Wikipedia hanno la chiave `wiki-…` e `"fonte": "wikipedia"`. |

## La prova di domenica 22 novembre

La stessa scaletta, alla stessa ora, una settimana prima. Niente di quello che si prova si vede ai lettori.

- **19:17, il registratore:** Run workflow con il modo **prova**. Scrive nel ramo `notte-prova`; il risultato si guarda con `?storia=notte-prova&feed=1`.
- **Lo spoglio:** `?prova=2023` simula la notte con i dati del 2023 («Avvia lo scorrimento»), anche in redazione per le card.
- **Gli exit poll da Wikipedia:** lo stesso Run workflow in modo prova rifà anche la notte del 2023 in `stime-prova.json`, una revisione della pagina di Wikipedia al minuto (sette in tutto, dalle 20:21 alle 21:12 di allora), con commit su `main` e pubblicazione. Si guarda con `?stime=prova`.
- **20:00, gli exit poll:** screenshot dei grafici delle reti (anche vecchi) a Claude, che li scrive in **`stime-prova.json`**, non in `stime.json`, fa commit e push. La pagina con `?stime=prova` (anche insieme: `?prova=2023&stime=prova`) li mostra dopo la pubblicazione di Pages, con l'etichetta «Exit poll di prova». Conviene cronometrare: dallo screenshot alla card pubblicata.
- **I guasti:** si può provare un registratore fermato a metà (Cancel run, poi di nuovo Run workflow) e l'inserimento manuale dei seggi.

## Dopo il voto

- **Spegnere il registratore**, che altrimenti ripartirebbe il 29 novembre di ogni anno: `gh workflow disable notte.yml` (o «Disable workflow» nella sua pagina).
- **Mercoledì 2 dicembre** si conta il voto dall'estero (CERA): può spostare qualche ultimo seggio, come nel 2023 a Madrid.
- La media dei sondaggi non si aggiorna più dal 29: non serve fare niente.

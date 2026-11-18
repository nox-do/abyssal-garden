# Optimierungsexperiment: Stand und Einstieg

**Aktuellster Stand (18.11.2026):** Der akzeptierte Blatt-/Auftauch-/Strandstand
ist lokal als `3178034` gesichert. Danach wurden auf Nutzerauftrag fuenf
Demoscene-Themen durch einzelne Agenten geplant und zwei kleine Versuche
umgesetzt: Nah-/Fernblaetter teilen und 16-Bit-Schatten. Sie sind auf Branch
`codex/demoscene-memory` in `source/` und `index.html` integriert und auf
Nutzerwunsch lokal committed; nichts gepusht. Details und Kosten:
[`demoscene-study.md`](demoscene-study.md).
HTML jetzt 105.306 B; nominal -55,005 MiB GPU-Ressourcen auf High, keine
Prozessspeichermessung. Geteilter Blattpuffer in 162 Bildern pixelgleich;
Schatten visuell beurteilt, nicht pixelgleich. Kleine CPU-/GPU-/Startzeitkosten
sind dokumentiert. Die folgenden Abschnitte beschreiben historische Stufen
und deren jeweils damaligen Integrationsstatus.

Wir haben Abyssal Garden aus dem Staticseal-Projekt heraus untersucht. Beide
liefern eine eigenstaendige, lokal nutzbare HTML-Datei aus. Gesucht waren konkrete
Einsparungen im Code und bei der Ausfuehrung, ohne die Unterwasserwelt optisch
oder funktional zu reduzieren. Allgemeine Vorschlaege zu CI oder Projektpflege
waren nicht das eigentliche Ziel.

Das Experiment liegt jetzt in `experiments/optimizations/` dieses Forks und
benoetigt keine Staticseal-Installation mehr. Unser Fork ist
[nox-do/abyssal-garden](https://github.com/nox-do/abyssal-garden), das Original
[Noniv/abyssal-garden](https://github.com/Noniv/abyssal-garden).

## Referenz und aktueller Zustand

- Referenzrevision: `a596354eff400d458bc2aeb9bdf5e0a9734b2bcf`.
- Der eingefrorene Ordner `experiments/optimizations/upstream/` enthaelt die
  Originalquellen, das originale HTML, README und die MIT-Lizenz.
- Der Original-Build wurde bytegenau reproduziert.
- Das eigentliche `source/` und `index.html` im Fork enthalten weiterhin den
  Originalstand. Die Varianten entstehen durch Transformationen im Experiment.
- `origin` zeigt auf unseren Fork, `upstream` auf Noniv. HTTPS verwendet den
  bestehenden GitHub-CLI-Zugang; es werden keine Tokens im Repository gespeichert.
- Der Umzug und diese Hinweise sind lokale Aenderungen; es wurde kein Commit
  erstellt und nichts gepusht. Vor weiterer Arbeit den aktuellen Status pruefen.

## Belegte Ergebnisse

| Variante | HTML-Bytes | Aussage |
| --- | ---: | --- |
| Original | 99.514 | Ausgangspunkt, rund 97,2 KiB |
| Original mit eingebettetem gzip | 56.506 | 43.008 Bytes weniger; JS nach Entpacken bytegleich |
| Nur Terser statt esbuild-Minifizierung | 98.383 | 1.131 Bytes weniger |
| Terser und eingebettetes gzip | 54.554 | 44.960 Bytes weniger; separater Build-Kandidat |

Die gzip-Variante komprimiert das JavaScript beim Build, bettet die Daten als
Base64 ein und entpackt sie beim Oeffnen mit `DecompressionStream`. Die Szene
bleibt komplett in der Datei. Fuer eine belastbare oeffentliche Aussage verwenden
wir die reine Kompression mit **43.008 eingesparten Bytes**, weil dabei der
wiederhergestellte Szenencode exakt dem Original entspricht.

Die Zahl gilt fuer die gespeicherte HTML-Datei. Mit zusaetzlichem HTTP-gzip
benoetigt das Original 40.287 Bytes, die gepackte Variante 41.197 Bytes. Daher
keinen gleich grossen Netzwerkgewinn behaupten. Die kleinen Build-Varianten
haben keine gemeinsame verschachtelte Kompressionsrechnung.

Weitere Codeexperimente:

- `nearFly`: die zwei billigen Hoehenvergleiche vor `Math.hypot` auswerten.
  Ein Test mit 20.000 synthetischen Abfragen bestaetigte gleiche Ergebnisse und
  eine deutlich geringere Laufzeit dieses Prädikats. Das ist keine Messung der
  gesamten Startzeit oder Framerate.
- Objekt-Indizes: `Uint16Array` statt `Uint32Array` und passende
  `setIndexBuffer`-Angaben. Alle Indizes der 26 Modelle wurden auf allen drei
  Qualitaetsstufen geprueft; groesster lokaler Index: 29.357. Der Objektindexpuffer
  auf High sinkt von 1.082.496 auf 541.248 Bytes. Terrain bleibt bei 32 Bit.
- Dichtefeld: den gemappten GPU-Lesepuffer direkt verwenden und erst nach der
  Weltgenerierung freigeben. Dadurch entfaellt eine 80-MiB-JavaScript-Kopie.
  Ein geringerer Gesamt- oder Spitzenspeicherverbrauch wurde nicht gemessen.

## Tests und Artefakte

`results/build.json` dokumentiert Groessen und SHA-256-Werte;
`results/data.json` enthaelt die Datenpruefungen;
`results/browser.json` die elf Browserfaelle und acht Vergleiche;
`results/browser-audio.json` ergaenzt den Tonstart nach einer Nutzeraktion;
`results/summary.json` fasst Ergebnisse und Grenzen zusammen.

Getestet wurde mit Chrome 157.0.8103.79 unter macOS, Apple-Metal-WebGPU,
1280 x 720 Pixeln. Die Dateien wurden ueber `file:` mit deaktiviertem Netzwerk
geladen. Es gab keine externen Ressourcenanforderungen oder JavaScript-Fehler.

Original gegen reine gzip-Variante sowie Original gegen `nearFly` + 16-Bit-Indizes:
Startansicht, sechs feste Kamerapositionen und eine Vorwaertsbewegung waren in
allen drei Qualitaetsstufen pixelidentisch. Die zusaetzliche Puffer-Variante und
Terser + gzip wurden auf High ebenso verglichen. Normale Animation wurde danach
fortgesetzt; Menue und Mute/Unmute wurden ausgeloest. Audio wurde mit erfolgreicher
Initialisierung und Zustand `running` nach Nutzeraktion geprueft, nicht durch
Vergleich der Klangdaten.

Die PNGs und generierten HTML-Dateien wurden mit umgezogen, sind aber in Git
ignoriert. Historische Berichte enthalten bewusst die frueheren absoluten
Staticseal-Pfade. Das sind keine aktuellen Laufzeitabhaengigkeiten. Beim Umzug
werden diese Berichte nicht als neue Browsermessung ausgegeben. Der Browserzugriff
auf lokale Dateien kann in einem Agenten-Chat durch die Werkzeugrichtlinie
eingeschraenkt sein; ein solcher Block ist kein Anlass, auf andere Steuerwege
auszuweichen. Die vorhandenen Nachweise bleiben einsehbar.

## Wiederholen

Node 24.22.1 ist in `experiments/optimizations/.node-version` festgehalten.
Das Paket besitzt eigene, exakt festgeschriebene esbuild- und Terser-Abhaengigkeiten
sowie eine Lockdatei. Vom Projektstamm aus:

```sh
npm ci --ignore-scripts --prefix experiments/optimizations
npm --prefix experiments/optimizations run build
npm --prefix experiments/optimizations run test:data
npm --prefix experiments/optimizations run test:browser
npm --prefix experiments/optimizations run summarize
```

Der Browser-Runner erwartet Chrome unter `/Applications/Google Chrome.app`,
nutzt ein eigenes temporaeres Profil und schliesst es am Ende. Er greift nicht
auf das persoenliche Chrome-Profil zu. Befehle und weitere Details stehen in
`experiments/optimizations/RUN.txt`. Tests ueberschreiben ihre Ergebnisdateien;
vor neuen Vergleichslaeufen gegebenenfalls den bestehenden Stand sichern.

## Moeglicher naechster Arbeitsschritt

Der Nutzer hat bisher den Fork und die Uebernahme des Experiments beauftragt,
keine Integration in den normalen Produkt-Build. Fuer eine Fortsetzung bieten
sich getrennte, gut pruefbare Aenderungen an:

1. `nearFly`-Reihenfolge und 16-Bit-Objektindizes in die echten Quellen uebernehmen.
2. Einen optionalen komprimierten Ausgabe-Build ergaenzen; lesbare und Dev-Builds
   fuer Entwicklung erhalten und die Browserunterstuetzung des Entpackers pruefen.
3. Die direkte Nutzung des gemappten Dichtefelds getrennt auf Speicherwirkung,
   Fehlerpfade und Buffer-Lebensdauer untersuchen.

Das Produktziel bleibt unveraendert: gleiche Welt, gleiche Bedienelemente,
gleiche Darstellungsqualitaet. Keine Einsparungen durch weniger Pflanzen,
niedrigere Aufloesung oder entfernten Ton als gleichwertige Optimierung verkaufen.

## Fortsetzung: nearFly-Alternativen (18.11.2026)

Der Nutzer hat einen Vergleich der besten Alternative bei gleicher Qualitaet
beauftragt. Neue Versuche liegen in `near-fly-alternatives.mjs`, getrennt von
den bisherigen Berichten. `npm run test:near-fly` im Experiment baut und prueft
Original, Hoehenfilter, Hoehen- plus Achsenfilter sowie Raster mit 8, 16 und
32 Metern Zellbreite. Die quadrierte Distanz wird diagnostisch mitgeprueft:
Sie weicht bei vier von 62.874 Grenz-/Rasterabfragen vom Original ab und ist
deshalb aus den Browserkandidaten ausgeschlossen. Dazu kommen 20.000
synthetische Abfragen mit den sechs tatsaechlich verwendeten Radien.

Die akzeptierten Alternativen behalten die originale `Math.hypot`-Pruefung bei.
Ein Raster beschleunigt die Kandidatensuche, entfernt aber keine Pfadpunkte.
Kein nearFly-Kandidat verkleinert die HTML-Datei oder die erzeugten Weltdaten:
Hoehenfilter 0 zusaetzliche HTML-Bytes, Achsenfilter +28 Bytes, Raster +479/480
Bytes. Die Raster benoetigen zusaetzlich 1.948/1.404/1.268 Bytes an Typed-Array-
Nutzdaten; Objekt-Overhead und temporaere Aufbauarrays sind darin nicht enthalten.
Das ist ein Zeit-/Speicher-Kompromiss, keine nachgewiesene Speicheroptimierung.

Reproduktion und Trennung zwischen Qualitaetspruefungen und Zeitmessungen:
siehe den neuen Abschnitt in `experiments/optimizations/RUN.txt`. Die Dateien
`results/near-fly-data.json`, `near-fly-browser.json`, `near-fly-browser-lower.json`,
`near-fly-timing.json` und `near-fly-summary.json` sind die neuen Nachweise.
Die bisherigen Berichte, Produktquellen und das ausgelieferte `index.html`
werden durch diese Versuche nicht veraendert.

Ergebnis: Alle fuenf akzeptierten Alternativen bestehen auf High, Medium und
Low den Vergleich der vollstaendigen serialisierbaren Weltdaten einschliesslich
aller zurueckgegebenen Typed Arrays sowie der acht Ansichten (Start, sechs
Posen, Bewegung). 18 Browserfaelle, 15 Alternativenvergleiche; Menue,
fortgesetzte Animation und laufender Audiokontext ebenfalls geprueft.

Separater Zeitvergleich auf diesem Mac (Apple M5 Pro, Chrome 157): ein
Aufwaermdurchlauf, danach fuenf Durchlaeufe je Variante auf High, frische Seiten
in einem gemeinsamen Chrome-Prozess, wechselnde Reihenfolge. Die Zeitvarianten
enthalten nur Zeitstempel, keine Abfrageaufzeichnung oder Weltdaten-Hashes.

| Variante | Weltaufbau Median | Bis Menue/erstem GPU-Bild Median | HTML-Differenz |
| --- | ---: | ---: | ---: |
| Original | 1.258,6 ms | 2.380,1 ms | 0 Bytes |
| Hoehenfilter | 1.031,6 ms | 2.129,5 ms | 0 Bytes |
| Hoehen- und Achsenfilter | 889,3 ms | 1.983,9 ms | +28 Bytes |
| Raster 8 m | 821,8 ms | 1.921,0 ms | +479 Bytes |
| Raster 16 m | 823,8 ms | 1.923,3 ms | +480 Bytes |
| Raster 32 m | 824,6 ms | 1.930,3 ms | +480 Bytes |

Empfehlung fuer unser Zeit-/Footprint-Ziel: Hoehen- und Achsenfilter. Er spart
hier 369,3 ms / 29,34 % des Weltaufbaus und 396,2 ms bis zum fertigen ersten
Bild, ohne zusaetzliche Arrays. Das schnellste Raster gewinnt darueber hinaus
nur rund 63 ms bis zum ersten Bild. Die kleinen Unterschiede zwischen den
Rasterbreiten sind bei den ueberlappenden Messbereichen kein belastbarer
allgemeiner Siegernachweis. Eine Speicher- oder Dateigroessenersparnis ergibt
sich aus keiner dieser nearFly-Varianten. Echte Footprint-Gewinne bleiben die
separaten Index-/Kompressionsexperimente.

Diese Zeiten gelten fuer den wiederholten lokalen Test auf diesem Rechner,
nicht fuer einen kalten Browser-/Systemstart oder andere Browser/Geraete.
Gesamt-/Spitzenspeicher wurde auch hier nicht gemessen. Die Empfehlung ist noch
nicht in `source/` oder `index.html` integriert; nichts wurde committed/gepusht.

## Fortsetzung: visuelle Qualitaet (18.11.2026)

Die neue Untersuchung steht in `docs/visual-quality-study.md`, mit eigenem
reproduzierbarem Paket unter `experiments/visual-quality/`. Sie basiert auf
den Produktquellen; die eingefrorene Referenz bleibt unveraendert.

Vier Materialzeilen in `source/src/shaders.js` wurden nach Bildvergleich
uebernommen: weniger starkes Textur-/Normalenrauschen bei Schwaemmen und
Korallen. `index.html` wurde regulaer neu gebaut. Der rundere Materialeindruck
ist vor allem an den Fassschwaemmen in Ansicht 4 sichtbar. Ein separater Versuch
zur Blattpunkt-Verteilung wurde wegen zu geringen Nutzens nicht uebernommen.

HTML weiterhin 99.514 Bytes, HTTP-gzip +2 Bytes. Auf High/Medium/Low sind
Weltdaten und GPU-Ressourcendeskriptoren identisch zur Baseline; 234 feste
Bilder sowie Bewegungs-/Audio-/Offline-Pruefungen. Separate Zeitmessung:
kein konsistenter GPU-Mehrbedarf, kein belegter Geschwindigkeitsgewinn.
Gesamt-/Spitzenspeicher weiterhin nicht gemessen. Der Browser-Runner verhindert
jetzt Pointer Lock in Testseiten, damit er nicht die physische Maus uebernimmt.

Die bisherigen Optimierungsempfehlungen (nearFly, Indizes, Kompression) sind
weiterhin nicht integriert. Dieser Stand wurde anschliessend auf Nutzerwunsch
lokal committed; nichts wurde gepusht. Naechster Schwerpunkt sind weniger
eckige Blaetter bei unveraenderter, vom Nutzer gut bewerteter Bewegung.

## Fortsetzung: Blattkonturen (18.11.2026)

Der Nutzer hat einen reversiblen Versuch beauftragt. Der vorherige akzeptierte
Produktstand ist lokal in `461db8a` gesichert. Nach Sichtung von Normalen,
zusaetzlichen Reihen und anderer Punktverteilung wurde eine mathematische
Konturmaske in `source/` und `index.html` uebernommen. Neue Untersuchung:
`docs/leaf-quality-study.md`, reproduzierbare Varianten unter `experiments/leaves/`.
Die eingefrorene Referenz bleibt unveraendert.

Rundere Raender ohne neue Texturen, Puffer oder Dreiecke. HTML +739 Bytes,
gzip +302 Bytes. Biegungs-/Wellen-/Stroemungsparameter bleiben erhalten;
die anders gerasterte Oberflaeche ist nicht pixelgleich animiert. Innere Knicke
stark verdrehter Blaetter bleiben sichtbar. Schwebende Felsen waren bereits
im Original absichtlich vorhanden und wurden nicht geaendert.

360 kontrollierte Bilder auf High/Medium/Low, darunter aufeinanderfolgende
30-Hz-Phasen; Weltdaten und Ressourcenanforderungen gleich, Offline, Bewegung,
Menue und Audio geprueft. Wiederholte Zeitmessung auf diesem Mac: High
je nach Ansicht +0,066 bis +0,721 ms GPU-Zeit, Low +0,131 ms. Kein belegter
Startzeitnachteil; kein gemessener Gesamt-/Spitzenspeicher. Der Mehrbedarf ist
ein bewusster Qualitaetskompromiss, kein Performancegewinn. Noch nicht committed
oder gepusht. Test-Runner unterdrueckt weiterhin Pointer Lock.

## Fortsetzung: Auftauchen (18.11.2026)

Der Nutzer hat Auftauchen, Wasser von oben, Sonne und eine sichtbare Kueste
beauftragt und ausdruecklich bestaetigt, dass der vorhandene etwa drei Meter
hohe Felsrand ausreicht. Der Versuch ist in `source/` und `index.html`, Details
in `docs/surface-study.md`, Vergleich und Messung unter `experiments/surface/`.

Mit E auftauchen, Q abtauchen, Shift beschleunigt. Maximal +0,28 m Augenhoehe;
zusaetzliche Koerperkollision und eine Hoehensicherung verhindern Landgang.
Nur positive Landschaftshoehen werden auf 1,5-3 m variiert; gleiche Verformung
fuer trockene Objekte/Pflanzen und Schatten. Unterwasserformen und alle 134
Weltdaten-Hashes bleiben gleich. Keine neuen GPU-Texturen oder Puffer.

Himmel/Sonne, Wasseroberseite und Luft-/Wasserabsorption sind erweitert. Die
Oberflaeche mischt die vorhandene Unterwasserszene mit Himmelsreflexion, ohne
zusaetzlichen Szenenrenderlauf. Bewusste Grenzen: keine Brechungsverzerrung
der Unterwasserobjekte, keine Spiegelung der Kueste, nur optische Wellen,
statische Sonne und Schatten. Die erste Version behielt die 150-m-Bewegungsgrenze;
der nachfolgende Ufer-Fix verschiebt sie hinter die Kueste (siehe unten).

HTML gegen den Blattstand: 100.253 auf 103.119 B (+2.866 B); gzip +1.037 B.
Wiederholte Messung auf diesem Mac: +0,066 bis +0,590 ms GPU in den geprueften
Unterwasseransichten. Kein belegter allgemeiner Startzeitnachteil; kalte
Shaderuebersetzung und Gesamt-/Spitzenspeicher nicht gemessen. Drei Stufen,
feste Bild-/Zeitvergleiche, Auf-/Abtauchen und Ufer-/Grenztests, Offline/Audio.

Noch nicht committed/gepusht. `experiments/surface/surface-only.patch` enthaelt
nur den Auftauchversuch und kann separat umgekehrt werden; danach regulaer
bauen. Vorherige Blatt- und Materialarbeiten bleiben so erhalten. Die
eingefrorene Optimierungsreferenz bleibt unveraendert.

## Fortsetzung: erreichbare Kueste (18.11.2026)

Nach Nutzerfeedback wurde die zu fruehe Grenze korrigiert: Kollisionsabdeckung
von etwa 156 auf 186 m, radiale Sicherung von 150 auf 180 m hinter den Felsrand.
Keine groessere Landschaft und keine zusaetzliche Geometrie. In den geprueften
Oberflaechenanlaeufen erreicht man nun im Norden/Osten/Westen etwa 166-169 m
statt 150 m; die vorhandene Felskollision stoppt den Schwimmer.

Alle drei Stufen: je 80 Wege in 16 Richtungen und fuenf Starttiefen, 600 Schritte
pro Weg; kein Durchdringen/Verlassen des Wassers in diesen Stichproben. 16 feste
Vorher-nachher-Bilder pro Stufe pixelgleich, 132 Welt-/Mesh-Hashes und alle GPU-
Allokationen identisch. Nur CPU-Kollisionsarrays wachsen um 786.272 B (~0,75 MiB).
HTML 103.118 B, gzip unveraendert. Einmaliger Kollisionsaufbau in den lokalen
QA-Laeufen +19,6 bis +21,9 ms, keine allgemeine Gesamtstart-/FPS-Aussage.

Details im Nachtrag von `docs/surface-study.md`; separate `boundary-*.json`-
Berichte unter `experiments/surface/results/`. Die vorherigen Auftauchberichte
bleiben historisch. `boundary-only.patch` nimmt nur den Ufer-Fix zurueck;
`surface-only.patch` wurde fuer den kompletten Auftauchversuch aktualisiert.

## Review und Strandkonzept (18.11.2026)

Auf Nutzerwunsch hat ein separater Agent Einsparpotenzial geprueft. Keine neue
Produktintegration. Prioritaet: unnoetige CPU-Arrays nach Upload freigeben
(2,5-2,7 MiB Nutzdaten), Objektindizes Uint16 (0,45-0,52 MiB GPU), danach ueber
Wasser bereits leere Lichtstrahl-Paesse ueberspringen. Statische Probebuilds und
aktueller gzip-Loader-Roundtrip unter `experiments/surface/review-footprint.mjs`
und `results/footprint-review.json`. Noch kein aktueller Browser-/Heap-Nachweis
fuer diese Kandidaten; Details im Review-Abschnitt von `docs/surface-study.md`.

Dort auch das noch nicht umgesetzte Strandkonzept: wenige Sandbuchten, kurze
Unterwasserboeschung, ruhige Sandnormalen/Nasssaum, vorhandenen freien Gruenkanal
der Bodenkarte nutzen. Terrainform und Kollision gemeinsam behandeln; bei
Formaenderungen die von Terrain-Vertexindizes abhaengige Platzierung beachten.

## Fortsetzung: Speicherbereinigung und erste Sandbucht (18.11.2026)

Nach Freigabe sind CPU-Aufraeumen nach Upload und Uint16-Objektindizes in
`source/` und `index.html` integriert. Terrainindizes bleiben Uint32. Gezaehlte
Array-Nutzdaten: 2.846.672 B High/Medium bzw. 2.625.928 B Low freigegeben;
GPU-Indexpuffer 541.248 B bzw. 475.548 B kleiner. Keine RSS-/Spitzenmessung.
136 Daten-Hashes pro Stufe identisch. 41 feste Bildpaare pro Stufe: High/Medium
pixelgleich; Low ein Pixel mit einer 8-Bit-Stufe Differenz in einem Bild,
alle anderen gleich. Dekodierter Nachweis in `memory-summary.json`.

Danach isolierter Strandversuch am westlichen Rand (x etwa -170, z=10): lokale
Hoehenabbildung oberhalb -4 m, inverse Abbildung fuer Kollision und bestehende
Volumenbeleuchtung, passende Normalen/Schatten/Pflanzen, Sandmaske im freien
Gruenkanal der vorhandenen Bodenkarte. Dunkler Nasssaum, ruhige Sandnormalen,
hellere trockene Flaeche. Sichtbarer Unterschied gegen die steile Felswand;
keine neuen Dreiecke, Instanzen, GPU-Puffer, Texturen oder Renderpaesse.
Topologie und Platzierungsarrays bleiben identisch; sichtbare Positionen im
Strandbereich werden im Shader verformt. Bestehende Blattbewegung erhalten.

HTML: vorher 103.118 B, nach Speicherbereinigung 103.145 B, mit Strand
105.121 B. Strand allein +1.976 B HTML/+775 B gzip, CPU-Kollision +12.288 B.
Diese 12 KiB sind 192 zusaetzliche gemischte 64-B-Blöcke, davon 191 zwischen
-2 und +0,25 m: fast vollstaendig neuer Unterwasserhang, kein Collider fuer
begehbares Land. Eine gesonderte zweidimensionale Ufersperre wurde deshalb
nicht eingebaut. Nach beiden Aenderungen netto 2,49-2,70 MiB weniger gehaltene
CPU-Nutzdaten plus die GPU-Indexersparnis. Quell-/Build-Hashes und genaue
Abgrenzung in `docs/surface-study.md`, `results/memory-*.json`, `beach-*.json`.

Strandpruefung auf allen drei Stufen: 288 Bilder, davon 45 feste Bildpaare pro
Stufe einschliesslich Nah-/Gesamtansichten, Wasserlinie und zeitlicher Sequenz.
Je Version/Stufe 90 Wege mit 600 Physikschritten; kein Landgang/Durchdringen in
diesen Stichproben, geringster Feldabstand 0,442 m. Westliches Ufer bleibt
erreichbar (x=-169,694 m statt -168,407 m). 130 von 135 Daten-Hashes gleich;
nur CI/CG, Bodenkarte und zwei Culling-Untergrenzen geaendert. Normaler Build
ebenfalls in drei Stufen offline mit Audio/Menue/Bewegung geprueft.

Die unterbrochenen Zeitlaeufe `beach-timing-standby.json` und
`beach-timing-interrupted.json` sind von Leistungsbehauptungen ausgeschlossen.
Aktuelle Zeitmessung und deren Grenzen stehen im Umsetzungsteil der
Oberflaechenstudie: voller neuer Lauf ab 15:59 UTC, ein Warmup plus drei Seiten
je Variante/Stufe. Lokale Mediane bis erstem Bild +76,8 bis +106,0 ms,
Kollisionsaufbau davon +51,6 bis +55,1 ms. Nahe Bucht GPU High +0,295 ms,
Medium +0,262 ms, Low innerhalb der Messaufloesung gleich; tiefe Ansichten
kleinere Mediandifferenzen bei teils stark schwankenden Runden. Keine
allgemeine FPS-/Startzeitgarantie. Vorhandenes Lichtvolumen ist nur raeumlich umgerechnet,
keine neu berechnete Lichtausbreitung; kurze Bildsequenzen belegen keine
allgemeine Artefaktfreiheit. Keine kalte Shader-/Gesamtspeichergarantie.

Rueckweg: zuerst `beach-only.patch` umkehren; danach entfernt der aktualisierte
`surface-only.patch` das Auftauchen samt Uferkorrektur unter Erhalt von
Speicher-, Blatt- und Materialarbeit. `memory-only.patch` entfernt separat die
Speicheroptimierung. Geprueft in temporaeren Quellkopien. Die eingefrorene
Referenz bleibt unveraendert; weiterhin kein neuer Commit oder Push.

## Lokaler Sicherungsstand (18.11.2026)

Auf Nutzerwunsch werden die seit `461db8a` entstandenen Blatt-, Auftauch-,
Ufer-, Strand- und Speicherarbeiten zusammen mit Quellen, regulaerem Build,
Versuchswerkzeugen, Messberichten und Dokumentation lokal committed. Die oben
stehenden Angaben zu damals uncommitteten Arbeiten sind historische Zustaende.
Kein Push beauftragt. Vergleichsbilder und generierte Varianten bleiben wie
bisher lokal ignorierte Artefakte, die eingefrorene Referenz bleibt unveraendert.

Der regulaere Build wurde vor dem Commit erneut bytegleich reproduziert:
`index.html` 105.121 Bytes = 105,121 kB = 102,657 KiB; gzip (Stufe 9)
42.433 Bytes. Der eingebettete gzip-Loader aus dem frueheren Experiment ist
weiterhin nicht in diesem Produkt-Build enthalten.

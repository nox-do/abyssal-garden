# Demoscene-Ideen: Daten teilen und Praezision passend waehlen

Basis ist der lokal gesicherte Produktstand `3178034` vom 18.11.2026:
105.121 Bytes HTML, gzip Level 9 42.433 Bytes. Dieser Commit enthielt bereits
Blattkonturen, Auftauchen, Kueste, Sandbucht und die bisherigen Speicherarbeiten.
Vor Beginn dieses Versuchs war der Arbeitsbaum sauber. Eigener Arbeitsbranch:
`codex/demoscene-memory`. Die eingefrorene Upstream-Referenz bleibt unveraendert.

Der Nutzer beauftragte ausdruecklich einzelne Planungsagenten und danach
reversible Versuche. Fuenf Agenten haben jeweils ein Thema bis zu konkreten
Datenlayouts, Risiken und Pruefschritten ausgearbeitet. Die ersten beiden
Versuche betreffen gespeicherte Daten; Szene und Sichtweite bleiben erhalten.

## Prioritaeten aus den fuenf Plaenen

| Thema | Erwarteter Nutzen | Aufwand / Risiko | Entscheidung dieser Runde |
| --- | --- | --- | --- |
| [Nah-/Fernblaetter teilen](../experiments/demoscene/plans/shared-leaves.md) | High 23,005 MiB GPU-Puffer und ebenso viel temporaeres CPU-Array weniger | Klein bis mittel: Packing, Vertexlayout, Zell-Draws. Mehr Draw-Aufrufe und ungerade Zellen pruefen. HTML +167 B | Isoliert umgesetzt und verglichen |
| [Schatten mit 16 Bit](../experiments/demoscene/plans/shadow16.md) | Nominal 32 MiB High, 8 MiB Medium/Low weniger | Klein: Texturformat und drei Pipelines. Tiefenquantisierung/Bias koennen Schattenkanten aendern. HTML +18 B | Isoliert umgesetzt und verglichen |
| [Blattparameter mit 24 Byte](../experiments/demoscene/plans/packed-leaves.md) | Vor Datenteilung rechnerisch 32,47 MiB High weniger | Mittel: neues Layout/Decode, Millimeterabweichungen und Bildnachweis. Anfangs vorgeschlagene 20 B riskant | Plan; noch nicht umgesetzt |
| [Pflanzen als Rezepte](../experiments/demoscene/plans/plant-recipes.md) | Potenziell groesserer Speichergewinn; noch nicht quantifiziert | Gross: RNG-Reihenfolge, globale Qualitaetsauswahl, Zellparitaet, Cache und Schatten | Zuerst Datenprobe fuer eine Pflanzenart; spaeter |
| [WGSL-Helfernamen kuerzen](../experiments/demoscene/plans/wgsl-minify.md) | Statische Probe -418 B HTML / -61 B gzip | Build-Lexer/Validator; Interfaces und Interpolationen erhalten. Kein GPU-Puffergewinn | Geringerer Nutzen, zurueckgestellt |

Die Einsparungen von geteilten und verdichteten Blattdaten sind **nicht voll
addierbar**: Ein entfernter Fernpuffer kann danach nicht nochmals komprimiert
werden. Fuer die drei noch offenen Themen sind Start-/Renderkosten ungeprueft.
Die Plaene enthalten ihre jeweiligen Mess- und Abbruchkriterien.

Ein wichtiger Befund aus der Planung: `yaw` bestimmt nicht nur Orientierung,
sondern auch eine empfindliche Glitzerauswahl. `hA` beeinflusst einen bestehenden
unstetigen Zweig der Biegung. Beide vorschnell auf 16 Bit zu runden koennte
Glitzern oder Bewegungsphasen aendern. Der vorsichtige Folgeversuch behaelt
diese zwei Float32-Werte exakt und packt nur die anderen sechs Parameter.

## Versuch 1: dieselben Blaetter aus einem Puffer lesen

`source/src/world.js`, `pack()`, schrieb bisher jeden zweiten grossen
Blattdatensatz noch einmal in `bigF.buf`. Nur die Breite unterscheidet sich:
`f32(f32(width) * 1.5)`. Die nahe Kopie ist ohnehin vorhanden.

Der Versuch behaelt `bigF.start/lo/hi` einschliesslich der bisherigen Auswahl
und Bounds. `source/src/main.js`, `pLeafF`, liest im nahen Vertexpuffer mit
72 statt 36 Byte Schrittweite. `drawCells()` setzt fuer jede sichtbare Zelle
deren genauen Offset und Bereich; so bleibt die Auswahl auch bei ungerader
Blattzahl pro Zelle richtig. Die Fernbreite wird in `W_LEAF` durch den
Override `WIDTH=1.5` hergestellt, fuer alle anderen Blattpipelines gilt 1.

Keine neuen Indizes, Texturen oder Shader-Storage-Puffer. `ibBigF` und seine
CPU-Vorlage entfallen. Die kleinen Fern-Metadaten bleiben (3.076 B). Die
temporaere CPU-Einsparung ist kein gleich grosser dauerhafter RAM-Gewinn:
Die alte CPU-Kopie wurde schon vor diesem Versuch nach dem Upload freigegeben.

Der Preis sind mehr Fern-Draws und Vertexbuffer-Bindings. In den sechs
aufgezeichneten Gesamtansichten steigen die Far-Draws von 8/8/7/8/6/4 auf
40/39/25/39/24/21. Andere Renderpfade behalten ihre zusammengefassten Draws.
Die Bedeutung dieser Mehrarbeit wird separat gemessen, nicht aus der Zahl
der API-Aufrufe abgeleitet.

## Versuch 2: passende Praezision fuer die statische Schattenkarte

In `source/src/main.js` bekommt ausschliesslich `tShadow` das Format
`depth16unorm`; die drei mit `shadowPipe()` erzeugten Pipelines passen dazu.
Bildtiefe und Dummy-Textur behalten `depth32float`. Schattenaufloesung,
Filterung, Sonne, Geometrie und Abtastanzahl bleiben gleich.

Zwei Bias-Varianten wurden isoliert verglichen. Der bisherige konstante Wert
2 hat bei UNORM16 eine andere Weltwirkung als bei Float32. `depthBias=0`
liegt hier naeher an den alten Bildern als 2. `depthBiasSlopeScale=1.5` und
der vorhandene Receiver-Bias bleiben erhalten. Der 300-m-Lichttiefenbereich
hat bei 16 Bit eine Quantisierungsstufe von etwa 4,58 mm; dies ist eine
Formatrechnung, kein gemessener Bildfehler.

Die Karte wird weiterhin einmalig gebacken. Deshalb entfaellt kein laufender
Renderpass. Weniger nominelle Texturbytes bedeuten auch keine garantierte
gleich grosse reale Treiberallokation oder eine automatische Beschleunigung.

## Daten, Bilder und Verhalten

Nachweise unter `experiments/demoscene/results/`, Reproduktion in
[`RUN.txt`](../experiments/demoscene/RUN.txt). Chrome 157, Apple-Metal-WebGPU,
1280 x 720, alle drei Stufen, Detailfaktor 1. Headless-Testprofil, Netzwerk aus,
Pointer Lock unterdrueckt; die persoenliche Maus und das Browserprofil werden
nicht uebernommen. QA- und Zeitmess-Builds sind voneinander getrennt.

- 16.384 synthetische Far-Datensaetze bytegleich rekonstruiert; 333
  Culling-/Draw-Faelle mit aufgezeichneten Bounds/Kameras, kuenstlichen
  Zellanzahlen und expliziten 24/58/150-m-Grenzen. Das ist ein Strukturtest.
- Zusaetzlich alle **echten** Fern-Datensaetze im Browser geprueft:
  670.083 / 353.816 / 195.701 fuer High/Medium/Low. Exakt gleiche Bytes nach
  CPU-Rekonstruktion, gleiche Zellmetadaten, gleiche Counts. QA baut hierfuer
  voruebergehend Referenzarrays; diese sind nicht in Produkt-/Timing-Builds.
- Alle 134 Welt-/Mesh-/Kollisionshashes beim Schattenversuch gleich. Beim
  geteilten Puffer fehlt ausschliesslich `Wd.bigF.buf`; die anderen 133 bleiben
  gleich. GPU-Deskriptoren unterscheiden sich nur an den geplanten Stellen.
- 324 Bilder im Schattenvergleich, danach 486 Bilder fuer Baseline,
  Shared-Far und Kombination. Pro Fall sechs Gesamtansichten, drei Nahbilder,
  Lagune, Kueste und vier Strandansichten; 30 aufeinanderfolgende Zeitpunkte
  und neun seitliche Kamerapositionen. Je Vergleich gleiche Kamera/Zeit.
- **Shared-Far: 162 von 162 Bildern pixelgleich.** Kombination und einzelner
  Schattenversuch stimmen in 161 von 162 Bildern ueberein; im verbleibenden
  Low-Kamerafahrtbild weicht ein gruener Kanal eines Pixels um 1/255 ab.
- Auf-/Abtauchen, Uferkollision, gerenderte Vorwaertsbewegung, Menue,
  Mute/Unmute, laufender Audiokontext und Offline-Start geprueft. Bewegung und
  Kollisionsresultate stimmen exakt ueberein. Kein Qualitaets-Fallback,
  WebGPU-/JavaScript-Fehler oder HTTP-Request in den geprueften Faellen.

**Aesthetische Einschaetzung:** Bei Shared-Far ist keine Bildaenderung zu
bewerten. Beim Schattenversuch liegen die Unterschiede an duennen
Schattenkanten, besonders an Pflanzen und Uebergaengen. In den geprueften
1:1-Ausschnitten und Zeitfolgen keine auffaellige neue Fleckenbildung,
abgeloesten Kontaktschatten oder grossen Spruenge erkannt. Die Bilder sind
ausdruecklich nicht pixelgleich und die Untersuchung deckt nicht jede frei
erreichbare Kameraposition oder jedes Geraet ab.

Der groesste mittlere RGB-Abstand pro Bild betraegt 0,01280 / 0,01199 /
0,01000 auf der 0..255-Skala. Einzelne Kanaele koennen an scharfen Kanten
staerker abweichen (bis 163 auf Low). Diese Zahlen dienen zur Lokalisierung,
nicht als pauschale Freigabeschwelle. Auch Aenderungen der Differenz zwischen
aufeinanderfolgenden Frames sind im Bericht enthalten. Eine kurze Zeitfolge
beweist keine allgemeine Flimmerfreiheit.

## Speicher und Dateigroesse

| Qualitaet | Geteilter Puffer | Schattenformat, nominell | Zusammen | Ressourcen vorher → nachher |
| --- | ---: | ---: | ---: | ---: |
| High | -23,005 MiB | -32 MiB | **-55,005 MiB** | 286,581 → 231,576 MiB |
| Medium | -12,147 MiB | -8 MiB | **-20,147 MiB** | 181,394 → 161,247 MiB |
| Low | -6,719 MiB | -8 MiB | **-14,719 MiB** | 111,987 → 97,268 MiB |

Die letzte Spalte zaehlt GPU-Puffer-Nutzdaten und nominelle Textur-Payloads
bei 1280 x 720. Zwei bereits zerstoerte 80-MiB-Dichtepuffer sind ausgeschlossen;
kleine Generatorpuffer sind konservativ enthalten. Browser, JS-Heap, Audio,
Treiber-Metadaten, Alignment/Kompression und Swapchain sind nicht vollstaendig
erfasst. Das ist **keine Messung von Prozess-RAM oder Spitzenspeicher**.

| Variante | HTML | gzip Level 9 | Differenz HTML / gzip |
| --- | ---: | ---: | ---: |
| Baseline | 105.121 B | 42.433 B | — |
| Shared-Far | 105.288 B | 42.522 B | +167 / +89 B |
| Shadow16, Bias 0 | 105.139 B | 42.449 B | +18 / +16 B |
| Kombination | **105.306 B** | **42.537 B** | **+185 / +104 B** |

Die Speicheroptimierung verkleinert also nicht die lokale HTML-Datei.
105.306 Bytes entsprechen 105,306 kB bzw. 102,838 KiB. Kein Entpacker,
externes Asset oder neue Laufzeitabhaengigkeit kommt hinzu.

## Zeitmessung und Uebernahme

Die separate Messung vergleicht alle vier Varianten: ein Aufwaermdurchlauf
und drei Messdurchlaeufe je Qualitaet, wechselnde Variantenreihenfolge und
rotierende Stufen. Pro Seite vier Ansichten, jeweils 20 Aufwaermbilder und
120 Samples. GPU-Zeitstempel messen die Renderpaesse; CPU-Zeit misst das
Encoding. Serialisierte Frames sind keine Gameplay-FPS-Messung. Startzeiten
gelten fuer wiederholte lokale Seiten in einem Browserprozess, nicht fuer
einen kalten System-/Browserstart. Die Bake-Marke umfasst Detailtextur und
Schatten gemeinsam. CPU-Einzelwerte sind auf etwa 0,1 ms aufgeloest; deshalb
werden neben Medianen auch Mittelwerte pro Messseite und deren Bereiche
ausgewiesen. Alle Rohwerte stehen in `timing.json`, Aggregate in `summary.json`.

| Qualitaet | Menue bereit: Baseline, Median [Bereich] | Kombination, Median [Bereich] | Differenz |
| --- | ---: | ---: | ---: |
| High | 2.469,7 [2.425,8–2.575,5] ms | 2.461,5 [2.442,5–2.537,5] ms | -8,2 ms |
| Medium | 2.363,4 [2.329,6–2.408,1] ms | 2.412,4 [2.356,9–2.503,6] ms | +49,0 ms |
| Low | 2.296,0 [2.281,9–2.298,4] ms | 2.323,8 [2.313,2–2.330,5] ms | +27,8 ms |

Das ist kein Startzeitgewinn. Auf Low liegen die drei Messbereiche in diesem
Durchlauf auseinander; die Kombination startet dort etwa 1,2 % spaeter.
Die Ursache laesst sich aus drei Seiten pro Variante nicht sauber zwischen
JIT, Weltaufbau, Upload und normaler Laufzeitstreuung trennen. Die gemeinsame
Bake-Marke sinkt im Median um 3,1 / 1,4 / 2,3 ms; daraus keinen allgemeinen
Shader- oder Startzeitgewinn ableiten.

GPU-Zeiten, jeweils Median der drei Seitenmediane in Millisekunden:

| Qualitaet / Ansicht | Baseline | Kombination | Differenz |
| --- | ---: | ---: | ---: |
| High / Pose 1 | 11,207 | 11,272 | +0,066 |
| High / Pose 6 | 8,454 | 8,356 | -0,098 |
| High / Lagune | 9,241 | 9,175 | -0,066 |
| High / Strand nah | 2,163 | 2,163 | 0 |
| Medium / Pose 1 | 8,847 | 8,913 | +0,066 |
| Medium / Pose 6 | 7,143 | 7,012 | -0,131 |
| Medium / Lagune | 7,143 | 7,274 | +0,131 |
| Medium / Strand nah | 1,769 | 1,769 | 0 |
| Low / Pose 1 | 3,473 | 3,473 | 0 |
| Low / Pose 6 | 2,556 | 2,556 | 0 |
| Low / Lagune | 2,556 | 2,621 | +0,066 |
| Low / Strand nah | 0,786 | 0,786 | 0 |

Die CPU-Encoding-Mittelwerte pro Seite liegen bei der Kombination im Median
um 0,001–0,030 ms pro Bild hoeher als bei der Baseline. Die Bereiche ueberlappen
teilweise. Die zusaetzlichen Zell-Draws sind also nicht kostenlos, aber hier
klein gegen die eigentliche Renderzeit. Im isolierten Shared-Far-Versuch liegt
High/Pose 1 um 0,328 ms GPU hoeher (11,534 statt 11,207 ms); diesen Einzelpreis
nicht mit dem guenstigeren Kombinationswert verschweigen. Es gibt keinen
nachgewiesenen allgemeinen FPS-Gewinn. Andere GPUs koennen auf Stride und
zusaetzliche Bindings anders reagieren.

**Entscheidung:** Beide Aenderungen zusammen sind als reversibler Versuch in
`source/src/main.js`, `shaders.js`, `world.js` und dem regulaer gebauten
`index.html` uebernommen. Rund 19,2 % weniger nominelle GPU-Ressourcen auf High
rechtfertigen hier +185 HTML-Bytes und die kleinen gemessenen Laufzeitkosten.
Keine Pflanze, Sichtweite, Aufloesung, Bewegung, Kollision oder Audiofunktion
wurde dafuer reduziert. Die Annahme beim Schattenformat ist die oben
dokumentierte visuelle Gleichwertigkeit, nicht Pixelidentitaet.

Der normale Build ist bytegleich zur geprueften Kombinationsvariante
(SHA-256 `e16462f0bc45d3e71bbcca7cafbce5363661aa0de7d5cb38098246b6355f1baa`).
Der abschliessende normale Offline-Start mit Audio/Menue/Bewegung auf allen
drei Stufen steht separat in `shipping.json`. Der Versuch wurde anschliessend
auf Nutzerwunsch lokal committed; nichts gepusht. Die Sicherung davor ist
`3178034`.

Unabhaengige Rueckwege, danach jeweils `npm --prefix source run build`:

```sh
git apply -R experiments/demoscene/shared-far-only.patch
git apply -R experiments/demoscene/shadow16-only.patch
```

Beide Rueckwege wurden mit `git apply --check -R` gegen den kombinierten
Produktstand geprueft. Sie erhalten den vorher akzeptierten Blatt-, Strand-,
Auftauch- und Materialstand. Die drei anderen Themen bleiben Plaene.

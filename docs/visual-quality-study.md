# Visuelle Qualität: Formen lesbarer machen

Stand: 18. November 2026. Basis: Produktquellen in `source/`. Die eingefrorene
Optimierungsreferenz wurde nicht verändert. Zu Beginn waren `AGENTS.md`, `docs/`
und `experiments/` untracked; diese vorhandenen Arbeiten bleiben erhalten.

## Ergebnis und Entscheidung

Ein kleiner Materialversuch wird übernommen: Schwämme und Korallen erhalten
weniger starke Störnormalen und geringeren Helligkeitskontrast der Detailtextur.
Die bestehenden Rundungen treten dadurch deutlicher hervor. Der stärkste
sichtbare Gewinn liegt bei den großen Fassschwämmen in Ansicht 4. Korallen
wirken etwas weniger wie zerbrochener Stein. Das ist eine gezielte lokale
Verbesserung, keine vollständige Neugestaltung der Unterwasserwelt.

Ästhetische Einschätzung: Der Materialunterschied zwischen Gestein und lebenden
Oberflächen wird überzeugender. Die ruhigeren Schwammkörper lassen Öffnung,
Rand und Bauch besser erkennen. Die Kehrseite: An wenig beleuchteten Stellen
sehen sie glatter aus; wer eine stark verkrustete Oberfläche bevorzugt, kann
den Ausgangszustand reizvoller finden. Die Röhrenschwämme behalten ihre
kantigen Silhouetten. Der Versuch behebt keine fehlende Geometrie.

![Identischer Ausschnitt, links vorher, rechts übernommenes Material, High bei t=8 s](../experiments/visual-quality/results/comparison-q0.png)

[Lokale Vergleichsgalerie mit Gesamt-, Detail- und Zeitansichten](../experiments/visual-quality/results/compare.html)

Ein vorheriger Versuch mit anders verteilten Blattstützpunkten wurde verworfen:
Im direkten Vergleich war der Gewinn zu klein bzw. bei starker Verschiebung
zum Ansatz durch längere gerade Blattspitzen erkauft.

## Diagnose aus Bildern und Code

Die sechs voreingestellten Ansichten zeigen bereits gute räumliche Tiefe,
erkennbare Schauplätze und vielfältige Farben. Nicht die reine Detailmenge ist
das Hauptproblem. Viele Details konkurrieren auf ähnlichen Größenordnungen;
manche Modell- und Beleuchtungsparameter betonen deren künstlichen Aufbau.
Die folgenden Bildbeobachtungen beziehen sich auf die neuen Aufnahmen bei
1280 × 720 Renderpixeln und Animationszeit 8 s, nicht auf beliebige Laufzeitbilder.

| Bereich | Beobachtbares Merkmal | Konkrete Ursache / vorhandenes Potenzial |
| --- | --- | --- |
| Gelände | In Ansichten 1, 2 und 4 wirken Wandflächen, aufgesetzte Brocken und nahe Bodenflächen durchgehend zerklüftet. Große Formen sind vorhanden, werden aber durch ähnlich starken Detailkontrast überlagert. | `shaders.js`, `W_DENS`: Worley-Skalen `.17` und `.41`, FBM `.3`, horizontale Schichtung; dazu `world.js:292` mit bis zu 60.000 Chunk-Versuchen. `W_SOLID` überlagert vier triplanare Detail-Skalen und startet mit `bump=1.7`. Das 0,75-m-Dichteraster (`math.js:55`) erklärt grobe Silhouetten; eine höhere Rasterauflösung wäre ein teurer Eingriff in Aufbau, Speicher und Kollision. |
| Kelp | Hohe, annähernd zylindrische „Flaschenbürsten“, darunter sehr ähnliche kleine Blattspitzen. Besonders rechts in Ansicht 6 sind Knicke und gefaltete Bänder auffällig. | `world.js:135–150`: 2–4 Stränge, regelmäßig alle 1,7 m Stielstücke, weitgehend gleichmäßig belegte Höhe, unabhängige Blattrichtungen. Es gibt bereits Höhen-, Längen- und Dichtevariation; es fehlt eher Variation der gesamten Pflanzenform als ein weiteres Zufallsfeld pro Blatt. |
| Blattkontur und Bewegung | Viele dünne Spitzen, scharf wechselnde helle/dunkle Teilflächen. Bewegung kann diese Falten betonen. | `shaders.js`, `W_LEAF`: Biegung, Welle, Torsion, Randkräuselung und globale Strömung werden überlagert. `v=sin(u*pi/2)` konzentriert Reihen an der Spitze. `main.js:101–104,476–479`: 9/5/3 Reihen, Wechsel auf Zellebene. Mehr Reihen würde nicht die zylindrische Pflanzenverteilung lösen. |
| Korallen und Schwämme | Fassschwämme besitzen brauchbare Rundungen, sehen aber wie zerknitterter Fels aus. Korallen ähneln stellenweise kantigen Kristallbündeln; die dunklen Ansätze und hellen Spitzen sind bereits hilfreich. | `world.js:406–437`: Lathe-Profile und Röhren; `meshCoral` hat nur zwei Grundformen und eine grobe LOD aus Dreiecksröhren. `main.js:281–288` erstellt dieselben Modelle für alle Instanzen. `shaders.js`, Material 4/5: ursprüngliche Störnormalen 1,4/1,5 gegenüber Fels 1,7; dieselben A/B/C-Texturquellen. Das vorhandene `i.ao` liefert bereits Form-/Spitzenverlauf, den starkes Rauschen überdeckt. |
| Platzierung und Größenbeziehungen | Wiederkehrende Pflanzenkolonnen und Korallenbüsche; teils abrupte freie Korridore neben dichten Flächen. Bewuchs ist nicht überall als zusammenhängende Kolonie lesbar. | `pickV()` wählt Terrainvertices gleichwahrscheinlich, nicht Oberflächenfläche. Detailreiche Meshbereiche werden dadurch bevorzugt. Harte `NOKELP`-Kreise sowie `nearFly`/`nearPose` schneiden Bewuchs aus. Das ist für Bedienbarkeit sinnvoll, erzeugt aber harte Bestandsränder. `snap`, `grad`, `floorsAt`, `magAt`, `zoneP` und Gruppen-Seed `sd` existieren bereits und können Wuchsform/Farbe räumlich koppeln. |
| Materialien / Bodenübergänge | Pinker Bodenteppich, Fels und Türkis dominieren gleichzeitig. Sandige Flächen unterscheiden sich nur begrenzt in ihrer Rauheit von Gestein. | `world.js:357–361` erzeugt schon eine Bodenkarte: Magenta, Zone und Sand. `shaders.js:315–337` benutzt `flt`, `gm.a` und `gm.r` für Farbe, aber dieselbe starke Felsnormalenbasis bleibt erhalten. Ein materialabhängiger Normalenfaktor könnte vorhandene Sanddaten wirksamer machen. |
| Licht / Wasser | Gute Tiefenstaffelung; Wrackansicht 2 und obere Bildteile haben zugleich einen sehr hellen türkisfarbenen Schleier. Fokale Formen konkurrieren mit Lichtmustern. | `shaders.js:210–268`: Tiefenabsorption, Streuung, Himmelslicht und Caustics sind vorhanden. `main.js:392` setzt `RAYS=.54`; `W_POST` mischt Bloom hinzu. Zuerst Gewichtungen und Lichtorientierung prüfen, keine neuen Posteffekte. Ein globales Abdunkeln würde dunkle Schluchten verschlechtern. |
| Animation / Zusammenhang | Die Welt bewegt sich vielfältig, aber Kelpblätter, einzelne Glints und Fischschwärme haben stark erkennbare eigene Rhythmen. Schwebende Felsen sind ein bewusst fantastisches Motiv, kein fehlender Bodenkontakt. | `sway()` ist bereits ein räumlich zusammenhängendes Strömungsfeld. Zusätzliche Blattphasen und Torsion sind unabhängig. Fischpositionen (`vsFish`, ab `shaders.js:506`) folgen Ellipsen. Schatten werden einmal bei t=0 gebacken (`main.js:304–324`), Pflanzen bewegen sich danach weiter: mögliche Schattenablösung, in diesem Versuch nicht als allgemeiner Bildfehler nachgewiesen. |

Wichtig für die Gewichtung: **Vegetationsproportionen und Materialhierarchie**
haben nach den Bildern den größten Hebel. Das Gelände braucht eher Ruhebereiche
und bessere Übergänge als flächendeckend feinere Geometrie. Wasser und Licht
tragen bereits wesentlich zur Qualität bei; Änderungen dort haben ein höheres
Risiko, den Charakter der gesamten Welt zu verlieren.

## Wenige priorisierte Optionen

Aufwände und Bytebereiche in dieser Tabelle sind technische Schätzungen für
eine kleine Implementierung samt Vergleich, keine Messwerte. Sichtbarer Nutzen
ist eine ästhetische Prognose, außer beim anschließend dokumentierten Versuch.

| Priorität / Option | Erwartete Wirkung | Aufwand / Eingriff | Ressourcenfolgen | Risiken, Bedienung und Qualitätsstufen |
| --- | --- | --- | --- | --- |
| 1. Organische Materialrauheit vom Fels trennen | Hoch an nahen Schwämmen, mäßig an Korallen, gering in Totalen ohne diese Objekte. Bereits sichtbar geprüft. | Vier Shader-Zeilen, wenige Stunden inklusive reproduzierbarer Prüfung. | Gemessen: 0 HTML-Bytes Differenz, gzip +2 B. Keine zusätzlichen Arrays, Texturen, Samples oder Draws. Laufzeitmessung separat unten. | Ruhigere Flächen können zu glatt wirken; Silhouetten bleiben kantig. Gleiche Materiallogik auf High/Medium/Low. Keine Änderung an Bewegung, Kollision, Eingabe oder Audio. |
| 2. Kelpproportionen und Bewegungsamplituden zusammen abstimmen | Hoher potenzieller Gewinn in Ansichten 1/3/5/6: weniger Flaschenbürsten, weniger gefaltete Plastikbänder. | Etwa 1–2 Tage; `column()` und `W_LEAF` gemeinsam. Bestehende Seeds für korrelierte Wuchshöhe, Blattlänge und Neigung verwenden; gleiche Blattanzahl behalten. | Vermutlich <1 KiB HTML, keine neuen GPU-Daten. Wenige zusätzliche Multiplikationen beim Aufbau; laufende Kosten nahe gleich, projizierte Blattfläche kann Füllrate ändern. | Nicht nur längere/dünnere Blätter: Low muss nach Ausdünnung noch Volumen zeigen. Schattenpass und 9/5/3-Reihen-LOD mitprüfen. Kein Freiräumen durch weniger Pflanzen. Die alleinige Reihen-Neuverteilung reicht nach dem Test nicht. |
| 3. Ruhige Sedimentflächen und nachvollziehbare Bewuchsübergänge | Mittel bis hoch über größere Bildbereiche: Fels, Boden und Kolonien besser unterscheidbar. | Materialteil klein, Verteilung mittel (1–3 Tage). `flt*gm.a` für Rauheit verwenden; bestehende `magAt`/Normalen/Höhe für Wuchsgruppen. Bestandszahlen explizit erhalten. | Materialteil voraussichtlich <0,5 KiB, gleiche Textursamples plus wenige ALU-Operationen. Verteilung eher 0,5–2 KiB; mehr Kandidatenprüfungen können Startzeit erhöhen, ohne neue dauerhafte GPU-Arrays. Kein gemessener Kostenvorteil. | Sand darf nicht wie glattes Plastik wirken. Umverteilung darf Wege und freie Kamera nicht blockieren; `snap` zum Untergrund weiterverwenden. High/Medium/Low mit gleicher räumlicher Logik prüfen; Ausdünnung kann kleine Gruppen verschwinden lassen. |
| 4. Lichtkontrast und Strömungszusammenhang fein abstimmen | Mittel, besonders am Wrack und in der Grotte; starke Abhängigkeit vom gewünschten fantastischen Stil. | Kleine Parameteränderungen, aber breite visuelle Prüfung (1–2 Tage). Vorhandenes `vol.g`, Schatten, `sway()` und Absorption nutzen. | Meist 0 bis einige hundert HTML-Bytes, keine neuen Renderziele; bei reinen Konstanten gleiche Sample-/Passzahl. | Hoher Stil- und Lesbarkeits-Einfluss. Keine pauschal kürzere Sichtweite; offene und dunkle Ansichten getrennt prüfen. Low hat andere Schatten und Lichtstrahlschritte, deshalb nicht nur High abstimmen. |

Nicht priorisiert: höhere Terrainauflösung, mehr Korallenäste, zusätzliche
AO-/Reflexionspässe, größere Detailtexturen. Deren Kosten wären sofort sicher,
ihr Zusatznutzen gegenüber den vorhandenen starken Form- und Materialreizen
ist bisher nicht nachgewiesen.

## Isolierte Versuche

`experiments/visual-quality/build.mjs` liest die aktuellen Produktdateien und
erzeugt getrennte Varianten. Nach Übernahme der Materialänderung rekonstruiert
es den alten Zustand durch die vier expliziten Rücktransformationen. Es gibt
keine zweite veränderbare Produktkopie und keinen Zugriff auf `upstream/`.

**Verworfener Blattversuch:** `uniform` ersetzt Sinusabtastung durch äquidistante
Reihen; `basal` durch `1-cos(u*pi/2)`. Bei 5 Reihen liegt die erste innere Reihe
ursprünglich bei 0,383 der Blattlänge, gleichmäßig bei 0,25 und basal bei 0,076.
In der 3-Reihen-LOD wandert der einzige innere Punkt von 0,707 auf 0,5 bzw.
0,293. Anzahl und Daten der Blätter bleiben gleich. Die Konturen ändern sich,
aber der Gesamteindruck gewinnt zu wenig. Basal verlängert zugleich das letzte
gerade Segment. Diese beiden Varianten bleiben ausschließlich im Experiment.
HTML: 99.502 B (uniform), 99.517 B (basal), jeweils gegen 99.514 B Ausgangspunkt.
Die sechs Totalen, drei näheren Ansichten sowie Zeit-/Kamerafolgen wurden auf
High erzeugt. Keine Übertragung dieser Bewertung auf ungetestete Geräte.

**Übernommener Materialversuch:**

| Parameter | Vorher | Nachher |
| --- | --- | --- |
| Schwamm: B-Helligkeitsmodulation | `.45 + .75*B.h` | `.70 + .25*B.h` |
| Schwamm: C-Helligkeitsmodulation | `.7 + .3*C.h` | `.8 + .1*C.h` |
| Schwamm: Störnormalenstärke | `1.4` | `.45` |
| Koralle: B-Helligkeitsmodulation | `.4 + .8*B.h` | `.65 + .3*B.h` |
| Koralle: Störnormalenstärke | `1.5` | `.5` |

Bei einer Texturhöhe von 0,5 bleiben die Helligkeitsfaktoren exakt gleich.
Es ist also keine pauschale Aufhellung. Textur, Porenmuster, Farbwahl, Glanz,
Fluoreszenz, Emission, Spitzenverlauf und Höhlenabdunklung bleiben vorhanden.
Die Änderung nutzt die vorhandenen Meshnormalen besser und reduziert ihre
Überlagerung durch Störnormalen.

## Reproduzierbarer Bild- und Funktionstest

Nachweise: `experiments/visual-quality/results/browser.json`, Original-PNGs im
gleichen Verzeichnis und `results/compare.html` als lokale Vergleichsgalerie.
Die Bilder werden nicht nachgeschärft oder farbkorrigiert. Ausschnitte in
`comparison-q*.png` sind 1:1-Pixel-Ausschnitte mit Beschriftung.

- Chrome 157.0.8103.79, macOS, Apple/Metal-3; eigener temporärer Browserkontext.
- `file:`-Aufruf, Netzwerk auf offline gesetzt; keine HTTP(S)-Ressourcenanfragen.
- High, Medium und Low; je Variante exakt 1280 × 720 **interne** Renderpixel,
  deviceScaleFactor 1, Detailfaktor 1. Dynamische Auflösung für den Vergleich
  angehalten. Low verwendet weiterhin seine eigene Geometrie, Ausdünnung,
  fehlendes MSAA, Schattenauflösung und Filterung. Seine normalerweise anfangs
  niedrigere Pixelzahl ist für diesen kontrollierten Vergleich überschrieben.
- Pro Fall 39 Bilder: sechs Gesamtansichten bei t=8 s, drei um 3 m angenäherte
  Kameras, neun weitere Zeitpunkte je in Ansicht 4 und 6 sowie zwölf
  Kameraschritte zu je 0,25 m in Ansicht 6 bei festem t=8 s.
- Die Zeitpunkte sind 8+1/30, 8+2/30, 8,1 bis 8,5, 9 und 10 s. Kamera und
  Zeit werden explizit gesetzt, nicht aus zufälliger Bildschirmaufnahme gewählt.
- Je Qualitätsstufe 134 Array-/Buffer-Hashes für Dichtefeld, Terrain, Welt,
  Kollisionsdaten und Modelle gleich. Alle 40 Buffer- und 17 Textur-
  Erstellungsdeskriptoren gleich. Das belegt gleiches Datenvolumen und gleiche
  Ressourcenanforderungen, nicht den tatsächlichen Treiberspeicher.
- Vorwärtsbewegung über den echten `frame()`-/Kollisionspfad geprüft;
  identischer Kamerazustand vorher/nachher in beiden Varianten. Dive-in, Escape,
  Mute/Unmute und danach laufende Animation ohne JS-/WebGPU-Fehler.
- Audiokontext nach Nutzeraktion `running`; kein Vergleich der Klangdaten.
  Touchbedienung und Pointer-Lock-Verhalten auf realen Geräten wurden nicht
  vollständig manuell geprüft. Ihr Code bleibt unverändert.

Visuelle Entscheidung: In der Totalen 4 und den 1:1-Ausschnitten aller drei
Stufen ist der rundere Schwammkörper erkennbar. Korallen im Vordergrund der
Ansicht 1 haben ruhigere Flächen; der Effekt ist kleiner. Architektur, Kelp,
Wasser, Blickführung und Umgebung behalten ihren bisherigen Charakter.

Zeitliche Prüfung: In den kurzen 30-Hz-Ausschnitten und den weiteren Phasen
bleiben die ruhigeren Schwammflächen konsistent; keine neue sprunghafte
Materialumschaltung sichtbar. Bewegte Lichtmuster bleiben erhalten. Die
Kamerafolge zeigt weiterhin die vorhandenen Vegetations-/LOD-Änderungen;
dieser Versuch ist keine Lösung für deren Übergänge. Die Stichproben sind
kein Nachweis für eine vollständig artefaktfreie frei erkundbare Welt.

## Kosten und Grenzen der Messung

Die uninstrumentierten HTML-Dateien sind beide **99.514 Bytes** groß.
Zusätzliches HTTP-gzip: 40.287 auf 40.289 Bytes, **+2 Bytes**. Es werden keine
Textursamples, Shader-Verzweigungen, Geometrie, Instanzen oder Renderpässe
hinzugefügt. Der Produkt-Build enthält keine Testhaken.

CPU-/GPU-Datenvolumen: im kontrollierten Lauf identisch. Gesamt- und
Spitzenspeicher des Prozesses sowie Shadercompiler-/Treiberallokationen wurden
nicht gemessen. Keine Aussage über einen Speichervorteil.

Die separaten Zeitläufe verwenden keine Weltdaten-Hashes oder Ressourcen-
Intercepts. Ein Aufwärmpaar pro Qualitätsstufe, danach fünf Messpaare mit
wechselnder Reihenfolge, frische Seiten in einem gemeinsamen Chrome-Prozess.
Jeder Fall misst drei Ansichten (1, 4, 6), jeweils 20 verworfene und 120
ausgewertete Frames. GPU-Zeiten stammen aus vorhandenen Timestamp-Queries;
CPU-Zeiten erfassen `render()`-Command-Encoding. Zwischen Frames wird auf die
GPU gewartet: Das ist ein kontrollierter GPU-/CPU-Kostenvergleich, keine
Messung der frei laufenden Browser-Framerate oder der Eingabelatenz.

Die numerische Auswertung steht in `results/summary.json`. QA-Startzeiten mit
zusätzlichem Hashing sind ausdrücklich keine Performanceergebnisse. Die
Startmessung endet nach dem ersten fertigen GPU-Bild am Menü; sie beschreibt
keinen kalten System-/Browserstart. Ergebnisse gelten für diesen Rechner.

Gemessene Mediane, jeweils **vorher → nachher**, Millisekunden. GPU-Werte sind
der Median der fünf Durchlaufmediane pro Ansicht:

| Stufe | Start bis fertiges erstes Bild | GPU Ansicht 1 | GPU Ansicht 4 | GPU Ansicht 6 |
| --- | ---: | ---: | ---: | ---: |
| High | 2.336,4 → 2.338,6 | 10,355 → 10,289 | 7,864 → 7,930 | 7,733 → 7,733 |
| Medium | 2.228,6 → 2.256,3 | 8,126 → 8,225 | 6,619 → 6,619 | 6,554 → 6,488 |
| Low | 2.184,7 → 2.193,7 | 3,211 → 3,211 | 2,687 → 2,621 | 2,294 → 2,294 |

Startmediane steigen hier um 2,2 / 27,7 / 9,0 ms; die Messbereiche überlappen.
GPU-Differenzen liegen zwischen −0,066 und +0,098 ms und zeigen keine
durchgängige Richtung. CPU-Encoding-Mediane liegen in allen Fällen bei rund
0,1 ms; die Zeitauflösung erlaubt keine Aussage über feinere Unterschiede.
Daraus folgt kein belegter Geschwindigkeitsgewinn, aber auch kein konsistenter
GPU-Mehrbedarf in dieser Stichprobe. Die Entscheidung beruht auf sichtbarem
Materialgewinn bei unverändertem Datenvolumen und praktisch gleicher lokaler
Renderlast, nicht auf behaupteten Performanceeinsparungen.

Der abschließende unveränderte Produkt-Build wurde zusätzlich auf allen drei
Stufen offline gestartet (`results/shipping.json`). Die ausgelieferte
`index.html` ist bytegleich zur uninstrumentierten Variante `organic.html`.
Die rekonstruierte Baseline besitzt weiterhin den ursprünglichen SHA-256
`ac151ea4a84092e529b98ac21feedc7905c170a7959f6bd6d829ef1b85e56767`.

Hinweis zum Testkomfort: Der erste Dive-in-Test konnte trotz Headless-Chrome
den Mausfang der Anwendung auslösen. Der Runner unterdrückt jetzt
`requestPointerLock` vor dem Laden ausschließlich in der Testseite. Der
abschließende Produkt-Test bestätigt den abgefangenen Aufruf und
`document.pointerLockElement === null`. Ein echter Mausfang wird damit
bewusst nicht mehr automatisiert getestet; das Produktverhalten bleibt gleich.

## Reproduktion

Vom Projektstamm; vorhandene Experiment-Abhängigkeiten werden wiederverwendet:

```sh
npm ci --ignore-scripts --prefix experiments/optimizations
node experiments/visual-quality/build.mjs
node experiments/visual-quality/browser.mjs
node experiments/visual-quality/timing.mjs
node experiments/visual-quality/browser.mjs --shipping
python3 experiments/visual-quality/analyze.py
```

`analyze.py` benötigt Pillow und NumPy. Die ausgeführten Tests verwendeten
Node 22.23.4 und esbuild 0.28.2. Der Browser liegt unter
`/Applications/Google Chrome.app`. Der Lauf benötigt Browserstart-Rechte;
innerhalb der Dateisandbox war kein Chrome-Debugging-Endpunkt erreichbar.
Der autorisierte lokale Test lief anschließend außerhalb dieser Sandbox.

Zusätzlicher Blattvergleich:

```sh
VISUAL_REPORT=sampling-browser.json node experiments/visual-quality/browser.mjs baseline:0 uniform:0 basal:0
```

Ergebnisdateien werden bei Wiederholung überschrieben. PNGs, Vergleichsgalerie
und generierte HTML-Varianten sind ignorierte lokale Artefakte. Produktänderung
und Untersuchungsdateien wurden anschließend auf Nutzerwunsch lokal committed;
es wurde nichts gepusht. Für den nächsten Blattversuch bleibt die vom Nutzer
gut bewertete Bewegung erhalten; untersucht werden Kontur und Normalen.

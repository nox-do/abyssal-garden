# Blattkonturen: kleiner Versuch ohne zusätzliche Geometrie

Stand: 18.11.2026. Ausgangspunkt ist der lokale Produkt-Sicherungscommit
`461db8a`, einschließlich der bereits akzeptierten Schwamm-/Korallenmaterialien.
Die eingefrorene Referenz unter `experiments/optimizations/upstream/` bleibt
unverändert. Implementierung und Nachweise: `experiments/leaves/`.

## Entscheidung und sichtbare Wirkung

Die Variante **contour** ist als reversibler Versuch in `source/` und dem daraus
gebauten `index.html` integriert. Die mathematische Blattbreite bestimmt jetzt
auch zwischen den Geometriepunkten den sichtbaren Rand. Es gibt keine neue
Textur, keine zusätzlichen Dreiecke und keine verringerte Pflanzenzahl.

Ästhetische Einschätzung: Breite Blätter wirken weniger wie ausgeschnittene
Vielecke. Besonders die grünen Blätter rechts in Weltansicht 6 haben rundere
Schultern und Ansätze. Der Gewinn ist lokal erkennbar; in Gesamtansichten bleibt
er dezent. Die Diagnoseblätter zeigen den Unterschied deutlicher als die normale
Spielsituation. Die bewusste Verbreiterung dort ist kein Beleg für eine ebenso
große Verbesserung in der ganzen Welt.

![Weltansicht 6: unskalierte Ausschnitte bei gleicher Kamera und t=8 s](../experiments/leaves/results/comparison-pose6-q0.png)

[Vergleichsgalerie mit allen Qualitätsstufen und synchronen Bewegungsfolgen](../experiments/leaves/results/compare.html).

Die vorhandenen Biegungs-, Wellen-, Torsions- und Strömungsparameter bleiben
unverändert. Die gerasterte Oberfläche verändert sich durch die andere
Darstellung: Das ist keine Behauptung pixelgleicher Bewegung. Die weiterhin
sichtbaren Knicke innerhalb stark verdrehter Blätter werden **nicht** behoben.
Die schwebenden Felsgruppen sind unveränderter Bestandteil des Originals.

## Ursache und geprüfte Alternativen

`source/src/shaders.js`, `W_LEAF.vs`: `v=sin(row/(ROWS-1)*pi/2)` konzentriert
Punkte an der Spitze. Bei fünf Reihen liegt die erste innere Reihe erst bei
38,3 % der Länge. Gleichzeitig wächst die Breite gemäß
`sin(pi*v^shp.x)^shp.y` nahe dem Ansatz sehr schnell. Für Kelp mit `shp=(.5,.32)`
entsteht deshalb ein langes gerades Dreieckssegment, obwohl die mathematische
Form rund wäre. Torsion und Randkräuselung werden über nur zwei Punkte pro Reihe
interpoliert; dadurch bleiben weitere diagonale Knicke möglich.

`source/src/main.js`, `pLeaf/pLeaf5/pLeafF` und `drawCells`: Die bestehenden
9/5/3 Reihen wechseln zellenweise ungefähr bei 24/58 m; die großen Zellen können
auch relativ nahe Blätter in einer gröberen Stufe zeigen. Mehr Reihen allein
nutzen die vorhandene Breitenfunktion deshalb nicht besonders effizient.

| Option | Sichtung / Entscheidung | Aufwand und Eingriff | Gemessene HTML-/gzip-Differenz | Ressourcen und Risiken |
| --- | --- | --- | ---: | --- |
| Normalenableitung `.10` → `.12`, nur Beleuchtung | Sehr kleiner sichtbarer Unterschied; Außenkante bleibt gleich. Nicht übernommen. | Kleiner Shaderzusatz; geometrisch verwendete Normalen absichtlich unverändert. | +139 / +31 B | Zusätzliche Vertexrechnung, gleiche Puffer. Kein belegter wesentlicher Nutzen. |
| Mehr Reihen: 13/7/5 statt 9/5/3 | Biegung teils glatter, Ansatz weiterhin polygonal. Nicht übernommen. | Drei Pipelinekonstanten und zugehörige Drawzahlen. | +2 / +1 B | Pro großem Blatt 44/40/67 % mehr Vertex-Aufrufe; keine neuen Datenpuffer. Weitere LOD-Abweichungen möglich. |
| Punkte an beiden Enden konzentrieren | Ansatz teils runder, dafür neue Knicke und längere gerade mittlere Abschnitte. Nicht übernommen. | Eine Shaderformel. | +7 / +3 B | Gleiche Zahl an Punkten/Puffern; betrifft auch Schatten und kleine Blätter. Keine überzeugende Gesamtverbesserung. |
| Mathematische Kontur auf einem breiten Trägerband | Deutlich rundere Schultern/Ansätze; stärkster lokaler Nutzen. Übernommen als Versuch. | Blattshader und Pipelineoptionen, einschließlich Schatten; keine Weltgenerierung geändert. | **+739 / +302 B** | Zusätzliche Fragmentrechnung, größeres Rastergebiet und ein 12-Byte-Interpolationsattribut. Keine neuen Texturen/Puffer. GPU-Kosten unten; Low ohne MSAA behält harte Pixelkanten. |

Aufwandseinstufungen und Qualitätsurteile sind Einschätzungen. Der erste
Zeit-Sichtungslauf auf High (`screen-timing.json`) misst für die drei Ansichten
1/4/6 GPU-Mediane von 10,224/7,864/7,733 ms bei der Baseline,
10,420/7,930/7,733 bei Normalen, 10,551/8,061/7,799 bei mehr Reihen und
10,355/7,864/8,061 bei umverteilten Punkten. Ein einzelner Lauf belegt keinen
allgemeinen Leistungsunterschied. Nur der ausgewählte Kandidat erhielt den
wiederholten Vergleich auf allen Qualitätsstufen.

## Umsetzung und Grenzen

`leafWidth()` verwendet dieselben typspezifischen Formparameter wie zuvor.
Große Blattbänder umschließen jetzt diese Form; `W_LEAF.fs` verwirft außenliegende
Fragmente und normiert die Querkoordinate für die vorhandenen Blattadern.
Stiele bleiben geometrisch unverändert. Kleine Bodendecker verwenden weiterhin
ihre ursprünglichen schmalen Bänder.

High und Medium verwenden das bereits vorhandene 4×MSAA mit Alpha-to-Coverage.
Die Kantenabdeckung wird aus `fwidth` abgeleitet. Low behält 1 Sample und einen
binären Schnitt; weder Texturauflösung noch Renderauflösung werden angehoben.
Der bestehende Schattenpass schneidet dieselbe Kontur aus, statt rechteckige
Träger zu beschatten. Schatten bleiben wie bisher einmalig bei t=0 gebacken.

Restliche Risiken: Knicke in der Biegung, seitlich sichtbare flache Bänder,
zellenweiser LOD-Wechsel und statische Schatten bleiben. Sehr kleine bewegte
Blätter können besonders auf Low weiterhin Pixel flimmern lassen. Die größere
projizierte Fläche kann auf anderen GPUs stärker kosten; mobile Geräte und
andere Browser wurden nicht gemessen.

## Prüfung

- Chrome 157.0.8103.79, macOS/Apple-Metal-3; Node 22.23.4. Eigener temporärer
  Browser, keine Übernahme des persönlichen Chrome-Profils oder der Maus.
- 360 Vergleichsbilder: zwei Varianten × drei Qualitätsstufen × 60 Ansichten.
  Jeweils 1280 × 720 interne Pixel, Detailfaktor 1, feste Kamera und Simulationszeit.
  Die anfangs niedrigere Standardauflösung von Low wird nur im Vergleich
  überschrieben. Seine sonstigen Qualitätsparameter bleiben bestehen.
- Sechs Totalen, drei Annäherungen, fünf frontale/seitliche Blattdiagnosen,
  je 16 aufeinanderfolgende Welt-/Blattbilder bei 30 Hz von t=8 bis 8,5 s,
  zusätzlich t=9 und 10 s, zwölf Kameraschritte bei fester Zeit.
- Pro Qualitätsstufe alle 134 Welt-/Mesh-/Kollisionsdaten-Hashes gleich.
  41 Buffer- und 17 Textur-Erstellungsdeskriptoren gleich. Der 41. Buffer
  enthält ausschließlich die beiden Diagnoseblätter (72 B); Produkt und
  Zeitvarianten haben ihn nicht. Zusätzlicher Shader-/Treiberbedarf wird von
  diesem Vergleich nicht erfasst.
- Identischer Kamerazustand nach 30 echten Bewegungsframes mit Kollision.
  Offline-Dateiaufruf ohne HTTP(S)-Anfragen, Menü, Mute/Unmute, laufender
  Audiokontext (48 kHz) und fortgesetzte Animation ohne JS-/WebGPU-Fehler.
  Kein Vergleich von Audiosamples; echtes Pointer Lock wird im Runner aus
  Rücksicht auf die Maus unterdrückt und daher nicht praktisch getestet.
- Separater Rauchtest des uninstrumentierten Produkt-HTML auf allen drei
  Stufen bestanden: Offline-Start, Dive-in/Audio, Bewegung, Mute/Unmute und Menü.
  Bericht: `experiments/leaves/results/shipping.json`.

Visuelle Zeitprüfung: In den aufeinanderfolgenden Diagnosebildern bleibt die
rundere Kontur bestehen; keine neu auftauchenden Löcher oder abrupten
Konturumschaltungen beobachtet. Das vorhandene Faltenmuster wandert weiterhin
mit der Animation. Die Welt- und Kamerastichproben sind kein Nachweis einer
vollständig artefaktfreien frei erkundbaren Welt. Numerische Bilddifferenzen in
`summary.json` sind ausdrücklich keine Qualitäts- oder Flimmerbewertung.

## Gemessene Kosten

Uninstrumentiertes HTML: **99.514 → 100.253 Bytes (+739 B, +0,743 %)**.
gzip: **40.289 → 40.591 Bytes (+302 B)**. Gleiche Instanzdaten, Vertexzahlen,
Draws, Texturen und Renderziele. Zusätzlich entstehen Fragmentarithmetik und
überdeckte Fragmente außerhalb des sichtbaren Blattes. Ein gleich großer
CPU-/GPU-Gesamt- oder Spitzenspeicher wurde nicht gemessen und wird nicht
behauptet; nur Daten und Ressourcenanforderungen sind nachweislich gleich.

Zeitmessung: Ein Aufwärmdurchlauf, danach drei frische Seiten pro Variante und
Qualitätsstufe in wechselnder Reihenfolge. Je Seite drei Kameras mit je
20 Aufwärm- und 120 Messframes. Kein Hashing und keine Diagnoseblätter im
Zeitlauf. GPU-Timestamps, CPU-Command-Encoding; zwischen Frames wird auf die
GPU gewartet. Keine Messung freier FPS, Eingabelatenz oder eines kalten Starts.

Mediane **vorher → Kontur**, in Millisekunden. GPU-Spalten: Median der drei
Durchlaufmediane; vollständige Messbereiche in `results/summary.json`.

| Stufe | Start bis erstes fertiges Bild | GPU Ansicht 1 | GPU Ansicht 4 | GPU Ansicht 6 |
| --- | ---: | ---: | ---: | ---: |
| High | 2.354,8 → 2.345,4 | 10,420 → 11,141 | 8,126 → 8,192 | 7,799 → 8,061 |
| Medium | 2.251,3 → 2.244,6 | 8,454 → 8,651 | 6,685 → 6,881 | 6,947 → 6,750 |
| Low | 2.199,1 → 2.204,1 | 3,211 → 3,342 | 2,621 → 2,753 | 2,294 → 2,425 |

High kostet hier zusätzlich 0,066–0,721 ms; der größte Unterschied liegt in der
pflanzenreichen Ansicht 1 (+6,9 %). Auf Low sind es in allen drei Medianen
0,131 ms (+4,1–5,7 %). Medium zeigt +0,197/+0,197/−0,197 ms bei überlappenden
Messbereichen: Der letzte Wert ist kein belegter Geschwindigkeitsgewinn.
CPU-Encoding-Mediane bleiben bei etwa 0,1 ms. Die Startmediane ändern sich um
−9,4/−6,7/+5,0 ms bei überlappenden Bereichen; kein belastbarer Startzeitnachteil.

Bewertung: Der Versuch ist **keine kostenlose Qualitätssteigerung**. Für den
sichtbar runderen Rand erscheint der gemessene kleine Mehrbedarf vertretbar;
die langsamer gewordene High-Ansicht sollte bei weiteren Änderungen im Blick
bleiben. Ein zusätzlicher Geometrieausbau oder weitere Effekte werden daraus
nicht abgeleitet.

## Reproduktion und Rückweg

Befehle: [experiments/leaves/RUN.txt](../experiments/leaves/RUN.txt).
`build.mjs` liest explizit die Produktdateien aus `461db8a`, keine veränderbare
Referenzkopie. Uninstrumentierte Baseline bytegleich mit dessen `index.html`;
regulärer neuer Produktbuild bytegleich mit `contour.html`.

Der Blattversuch ist noch nicht committed oder gepusht. Die vorherige akzeptierte
Version bleibt im lokalen Commit `461db8a` gesichert. Für eine Rücknahme nur
die Blattänderungen in `source/src/shaders.js` und `source/src/main.js` rückgängig
machen und regulär neu bauen; bei späteren weiteren Änderungen keinen pauschalen
Datei-Restore verwenden.

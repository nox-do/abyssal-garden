# Auftauchen bei unveränderter Weltgröße

18.11.2026. Vom Nutzer beauftragter Versuch: Wasser von oben, Himmel und Sonne,
vorhandener Felsrand als niedrige unüberwindbare Küste. Drei Meter Höhe reichen
ausdrücklich aus; kein größeres Geländeraster und keine neue Hügelwelt.

## Stand und sichtbare Wirkung

Der Versuch ist in `source/` und im regulär gebauten `index.html`. Mit **E**
auftauchen, optional **Shift** für schnelleres Schwimmen; mit **Q** abtauchen.
Der ursprüngliche Startpunkt und die sechs Aussichtspunkte bleiben unter Wasser.
Der Spieler kann an der Oberfläche schwimmen, aber nicht aufs Land steigen.

Die Augen liegen höchstens 28 cm über dem mittleren Wasserspiegel. Himmel und
Sonnenscheibe erscheinen; bei flachem Blick reflektiert die Wasserfläche stärker,
bei steilem Blick bleibt die Unterwasserwelt sichtbar. Die vorhandenen
Wellennormalen steuern Glanz und Spiegelung. An der Küste unterscheiden sich
nasser Saum und trockener Stein. Die Kontur des vorhandenen Randes variiert
zwischen etwa 1,5 und 3 m, statt überall exakt waagerecht abzuschließen.

![Westliches Ufer, High, t=8 s, 1280 × 720](../experiments/surface/results/surface-q0-west.png)

[Lokale Vergleichsgalerie](../experiments/surface/results/compare.html).

Ästhetische Einschätzung: Auftauchen schafft einen klaren Orts- und Lichtwechsel.
Die bestehende Begrenzung wird als Küste verständlich. Die Küste ist noch einfach
und recht steil; es wurde kein Strand mit neuem Bewuchs oder neuen Objekten
modelliert. In den tiefen Gesamtansichten ist der Unterschied zur vorherigen
Version sehr klein, aber nicht pixelgleich.

## Umsetzung

- `main.js`, `SURFACE_EYE`, `rockAt`, `sd`, `collide`, `frame`: Die bisherige
  Grenze −1,2 m wird durch +0,28 m ersetzt. Nahe der Oberfläche kommt zum
  vorhandenen Kopf-Kollisionsvolumen ein bis zu 0,9 m tieferer Körper hinzu.
  Eine Kollisionskorrektur, die den Spieler aufs Ufer heben würde, wird für den
  betreffenden Bewegungsschritt zurückgenommen. Tiefe Bewegung bleibt gleich.
- `shaders.js`, `W_SURF`: Die Wasserfläche wird pro Pixel mit dem Sichtstrahl
  geschnitten und schreibt ihre Tiefe. Dadurch verschwindet sie beim Auftauchen
  nicht an der kameranahen Clipping-Ebene. Ein Übergang von −6 bis +6 cm mischt
  die Ansichten. Dies ist eine optische Annäherung an den Übergang an der Kamera.
- Die Wasseroberseite wird nach der Szene durch Alpha-Blending darübergelegt.
  Vorhandenes Unterwasserbild und Himmelsreflexion werden nach Blickwinkel
  gemischt. **Keine zusätzliche Bildtextur und kein zweiter Szenenrenderlauf.**
- `airSky`, `fog`, `sunE`, `amb`: Himmel und Sonne sind prozedural. Wasserabsorption
  wirkt auf den untergetauchten Teil des Blickwegs. Trockenes Gelände erhält
  Luftbeleuchtung; Unterwasser-Lichtstrahlen werden oberhalb der Oberfläche
  nicht addiert. Die Sonnenrichtung bleibt unverändert.
- `coastPosition`, `coastNormal`: Nur positive Höhen werden reduziert, mit
  angepassten Felsnormalen. Dasselbe Höhenfeld verankert trockene Felsen, Pflanzen
  und Glints. Die bestehende Schattenberechnung verwendet dieselbe Verformung.
  Gelände- und Instanzpuffer bleiben unverändert; Unterwasserpositionen ebenfalls.
- Das Terrain wird nahe/über Wasser bis 400 statt 240 m berücksichtigt, damit
  auch die gegenüberliegende Küste sichtbar bleibt. Pflanzenreichweite und
  -anzahl werden nicht reduziert. Das kann mehr vorhandene Terrainzellen zeichnen.
- `audio.js`: Dieselben Filter und Stimmen bleiben erhalten. Beim Auftauchen
  wird das Oberflächenrauschen heller, das tiefe Rumpeln leiser und neue
  Blasengeräusche zurückgenommen. Keine neuen Audiodateien, Buffer oder Stimmen.

## Bewusste Grenzen des ersten Versuchs

Der Blick durch die Wasseroberfläche verzerrt die Unterwasserobjekte noch nicht
durch Brechung. Spiegelungen zeigen Himmel und Sonne, keine gespiegelte
Küstengeometrie. Die Wellen sind optisch, die geometrische Wasserhöhe bleibt null.
Sonne und Küstenschatten sind statisch; die Schatten werden wie bisher einmal
beim Start gebacken. Der kurze Übergang ersetzt keine physikalische Simulation
einer teilweise benetzten Kamera. Deshalb keine Behauptung fotorealistischer
Wasseroptik oder vollständig dynamischer Schatten.

Der erste Versuch behielt die radiale Bewegungsgrenze von 150 m bei. Sie stoppte
den Spieler noch vor dem sichtbaren Felsrand. Diese Einschränkung wurde nach
Nutzerrückmeldung korrigiert; siehe den Nachtrag zur erreichbaren Küste unten.

## Daten und Funktionsprüfungen

Chrome 157.0.8103.79 unter macOS/Apple-Metal-3, Node 22.23.4. High, Medium, Low
bei jeweils 1280 × 720 internen Pixeln und Detailfaktor 1. Low behält seine
übrigen Qualitätsparameter; nur seine anfängliche kleinere Auflösung ist im
Vergleich überschrieben. Browserprofile sind temporär; Mausfang wird unterdrückt.

246 Bilder bei festen Kameras und Simulationszeiten: sechs Gesamtansichten,
drei Details, sieben Oberflächenansichten, acht Höhen um die Wasserlinie und
17 weitere Wellenzeitpunkte pro Variante/Stufe. Die Wellenfolge enthält mit
dem Ausgangsbild 16 aufeinanderfolgende 30-Hz-Bilder von 8 bis 8,5 s sowie
die Phasen 9 und 10 s. Unterwasserbilder werden direkt verglichen; die alten
Oberflächenbilder verwenden eine Diagnosekamera außerhalb der alten Steuergrenze.

Je Stufe alle **134 Daten-Hashes**, **40 Buffer-** und **17 Textur-Deskriptoren**
gleich. Der tiefe Bewegungsvergleich endet in exakt gleicher Kamera und Zeit.
Je Stufe sechs Bewegungsprüfungen: Auftauchen, Abtauchen, gegen eine Felsinsel
sowie gegen Nord-, Ost- und Westgrenze schwimmen. Die Augen überschreiten in
keinem geprüften Frame +0,28 m. Beim Inselversuch endet die Kamera vor dem Fels
bei z≈−94,38 m; Kopf- und Körpersamples liegen außerhalb des Gesteins.

Offline-Dateiaufruf ohne HTTP(S)-Ressourcen, keine JS-/WebGPU-Fehler, Menü,
Mute/Unmute, laufender Audiokontext und fortgesetzte Animation geprüft. Kein
Vergleich von Klangsamples und kein manueller Test aller Touchgeräte.
Auch der separate Start-/Bedienungs-/Audiotest des uninstrumentierten
Produkt-HTML besteht auf allen drei Stufen (`results/shipping.json`).

Die erste Sichtung zeigte einen harten Farbwechsel direkt bei y=0; daraufhin
wurde der kurze Übergangsbereich eingeführt. In den endgültigen Höhenbildern
geht die Farbe kontinuierlicher über und es erscheint keine schwarze Lücke.
Die Bewegungsstichproben sind kein allgemeiner Nachweis von Artefaktfreiheit.

## Kosten

Vergleichsbasis ist die bereits akzeptierte Blattkonturversion:
**100.253 → 103.119 HTML-Bytes, +2.866 B (+2,86 %)**.
gzip: **40.591 → 41.628 B, +1.037 B**. Keine zusätzlichen Texturen,
Geometrie-/Instanzpuffer oder Audionutzdaten. Zusätzlicher Shader-/Treiber-
und JavaScript-Objektbedarf ist nicht als Gesamt-/Spitzenspeicher gemessen.

Laufende Kosten entstehen durch die Oberflächenrechnung pro Pixel, zusätzliche
Luft-/Wasserentscheidungen, Schattenabfragen für den Wasserglanz und gegebenenfalls
mehr sichtbare Terrainzellen. Die zusätzliche Körperkollision greift nur nahe
der Oberfläche. Die Renderzeitmessung misst diese Bewegungsrechnung nicht.

Separate Zeitmessung ohne Hashing/Allokationsaufzeichnung: ein Aufwärmdurchlauf,
drei Messdurchläufe pro Variante/Stufe, wechselnde Reihenfolge, je drei Kameras
mit 20 Aufwärm- und 120 Messframes. GPU-Timestamps und CPU-Command-Encoding,
keine freie FPS- oder Latenzmessung. Die wiederholten Starts können Shadercaches
nutzen; kalte Shaderübersetzung ist dadurch nicht zuverlässig bewertet.

Endgültige Zahlen: `experiments/surface/results/summary.json`.

Mediane in Millisekunden, Unterwasserwerte **vorher → Versuch**. Jeweils Median
der drei Durchlaufmediane. Der Oberflächenwert ist nur die neue Version;
die alte Darstellung über Wasser ist kein gleichwertiger Leistungsvergleich.

| Stufe | Start bis fertiges erstes Bild | GPU Unterwasser 1 | GPU Unterwasser 6 | GPU Oberfläche |
| --- | ---: | ---: | ---: | ---: |
| High | 2.366,2 → 2.374,3 | 10,813 → 11,403 | 7,995 → 8,258 | 9,110 |
| Medium | 2.251,5 → 2.282,1 | 8,520 → 8,782 | 6,685 → 6,947 | 7,078 |
| Low | 2.181,1 → 2.161,9 | 3,408 → 3,539 | 2,425 → 2,490 | 2,556 |

In diesen Unterwasseransichten zusätzlicher GPU-Bedarf von 0,066–0,590 ms
(etwa 2,7–5,5 %). CPU-Encoding liegt meist bei ungefähr 0,1 ms; die
Zeitauflösung erlaubt keine feinere Aussage. Startmediane ändern sich um
+8,1/+30,6/−19,2 ms. Auf High und Low überlappen die Messbereiche; Medium startet
in diesen drei Läufen etwas langsamer, bei ebenfalls schwankender Weltaufbauzeit.
Daraus folgt kein allgemeiner Startzeitgewinn oder -nachteil. Gerade die erste
Shaderübersetzung kann davon abweichen. Die Zahlen gelten für den lokalen Mac
und diese Ansichten.

Bewertung: Für den neuen erreichbaren Blick auf Himmel, Sonne und Küste erscheint
dieser gemessene Mehrbedarf als Versuch vertretbar. Es ist eine neue Funktion
mit zusätzlichen Kosten, keine Performanceoptimierung.

## Reproduktion und Rückweg

[Befehle und Testdetails](../experiments/surface/RUN.txt). Die Baseline entsteht
aus den Produktquellen von `461db8a` plus der akzeptierten Blatttransformation;
der Kandidat aus den aktuellen Produktquellen. Die eingefrorene Optimierungs-
referenz wurde weder angepasst noch für diesen Versuch benötigt.

`experiments/surface/surface-only.patch` enthält ausschließlich diesen Versuch.
Ein umgekehrter Apply-Check ist erfolgreich; damit können die Auftauchänderungen
separat zurückgenommen werden, während Material- und Blattverbesserungen erhalten
bleiben. Anschließend regulär neu bauen. Nichts wurde committed oder gepusht.

## Nachtrag: bis an die Küste schwimmen

Die Rückmeldung war nachvollziehbar: Über und unter Wasser stoppte die alte
150-m-Grenze deutlich vor der sichtbaren Küste. Nur den Bewegungsradius zu
erhöhen hätte nicht ausgereicht: Auch das komprimierte Kollisionsfeld endete
bei etwa 156 m und hätte den weiter außen liegenden Fels nicht erfasst.

`main.js`: Kollisionsraster `CO=8`, `CN=124`, berücksichtigter Radius 186 m.
Die zusätzliche radiale Sicherung liegt jetzt bei 180 m, hinter dem sichtbaren
Fels. Die vorhandene Geländedichte, Geometrie, Pflanzen und Shader bleiben
gleich. Die größere Kollisionsabdeckung verwendet das schon erzeugte Dichtefeld.
Die Grenze für die Augenhöhe und die Sicherung gegen Landgang bleiben erhalten.

Im geprüften Oberflächenanlauf liegt der erreichte Radius im Norden bei
165,84 m, im Osten bei 168,56 m und im Westen bei 168,41 m, zuvor jeweils 150 m.
Man schwimmt jetzt bis direkt vor den sichtbaren Stein. Die Nahbilder bestätigen
den Kontakt; die frühere große Wasserlücke verschwindet. Der Kollisionsabstand
von ungefähr einem halben Meter bleibt zum Schutz vor Durchdringen bestehen.

Nachweise separat in `results/boundary-build.json`, `boundary-browser.json`
und `boundary-shipping.json` unter `experiments/surface/`. Die älteren
Auftauchberichte bleiben als historischer Stand erhalten.

- Vorher/nachher auf High, Medium und Low: jeweils 16 feste Gesamt-/Detailbilder
  bei identischer Kamera, Zeit und 1280 × 720 Pixeln **pixelgleich**; zusätzlich
  drei Bilder der jetzt erreichbaren Küste pro Stufe, insgesamt 105 Bilder.
- Je Version/Stufe 80 Schwimmwege: 16 Richtungen bei +0,28 / −2 / −12 / −30 /
  −40 m Starttiefe, je 600 Physikschritte bei 60 Hz. Jeder Schritt auf endliche
  Koordinaten, Augenhöhe, Radius und Kollisionsabstand geprüft. Diese langen
  Physikreihen laufen ohne Rendering zwischen den Schritten; sie sind kein
  zeitlicher Bildvergleich und keine Messung der Framerate.
- In den neuen 240 Wegen kein Durchdringen und kein Landgang. Kleinster
  gemessener Abstand im approximierten Kollisionsfeld: 0,4755 m. Größter
  erreichter Radius 171,33 m, also keine Berührung der 180-m-Sicherung.
  Ein zusätzlicher Ringtest bei 178 m in 0,5°- und 0,25-m-Höhenschritten
  bestätigt durchgehenden Fels an allen geprüften Stellen.
- Alle 132 übrigen Welt-/Mesh-Hashes sowie die 40 GPU-Buffer- und 17 Textur-
  Deskriptoren bleiben gleich. Nur die zwei CPU-Kollisionsarrays ändern sich.
  Der vorhandene tiefe Bewegungsvergleich bleibt exakt gleich. Offline,
  Menü, Audio und das reguläre Produkt-HTML wurden erneut auf allen Stufen
  geprüft; kein Mausfang, keine JS-/WebGPU-Fehler.

Gemessene Kosten gegenüber dem ersten Auftauchstand:

| Größe | Vorher | Jetzt | Differenz |
| --- | ---: | ---: | ---: |
| HTML | 103.119 B | 103.118 B | −1 B |
| gzip | 41.628 B | 41.628 B | 0 B |
| CPU-Kollisionsarrays CI + CG | 2.418.336 B | 3.204.608 B | +786.272 B / rund 0,75 MiB |
| Kollisionsaufbau High | 50,8 ms | 72,3 ms | +21,5 ms |
| Kollisionsaufbau Medium | 53,8 ms | 73,4 ms | +19,6 ms |
| Kollisionsaufbau Low | 51,1 ms | 73,0 ms | +21,9 ms |

Aufbauzeiten sind einzelne lokale Durchläufe je Stufe innerhalb des QA-Laufs,
keine unabhängige wiederholte Gesamtstartmessung. Gesamt-/Spitzenspeicher und
CPU-Cacheeffekte sind nicht gemessen. Der Rendercode und die GPU-Allokationen
ändern sich nicht; an neu erreichbaren Kamerapositionen kann die sichtbare
Szenenlast trotzdem anders ausfallen. Keine neue GPU-Zeitmessung für diesen Fix.

`boundary-only.patch` erlaubt das separate Zurücknehmen dieser Korrektur;
`surface-only.patch` wurde aktualisiert und nimmt den gesamten Auftauchversuch
einschließlich Uferkorrektur zurück. Beide Reverse-Checks bestanden. Anschließend
regulär neu bauen. Die eingefrorene Referenz bleibt unverändert.

## Entwurf: kleine Sandbuchten mit geringem Zusatzbedarf

Historischer Entwurf vor der unten dokumentierten Umsetzung. Der Nutzer hat parallel zum Footprint-Review ein Konzept
für einen hübschen Strand beauftragt. Ausgangspunkt sind die vorhandenen
Uferbilder: fast durchgehend steiler Stein, eine weitgehend horizontale
Silhouette und starkes Gesteinsrauschen bis an die Wasserlinie.

**Gestaltung:** Zwei oder drei unterschiedlich breite, asymmetrische Sandbuchten
zwischen bestehenden Felsvorsprüngen. Eine kurze sandige Unterwasserböschung,
ein dunkler feuchter Saum, dann heller, ruhiger trockener Sand vor der vorhandenen
1,5–3-m-Kulisse. Der Sand soll über größere zusammenhängende Flächen lesbar sein;
wenige vorhandene Steine können an den Übergängen gruppiert werden. Keine
gleichmäßig helle Ringfläche um die ganze Welt. Zuerst eine einzige Bucht als
kontrollierter Versuch, dann erst weitere verteilen.

Konkrete Möglichkeiten im bestehenden Code:

- `shaders.js`, `W_DENS` (`ring`, `th`, abschließendes Dichtefeld): In der
  äußeren, oberflächennahen Zone das Profil lokal abflachen und das geometrische
  Felsrauschen dämpfen. Das bestehende 512 × 80 × 512-Raster reicht aus;
  die Begrenzung hinter der Bucht bleibt geschlossen. Gelände, Kollision,
  Volumenbeleuchtung und Platzierungen müssen aus demselben geänderten Feld
  entstehen. Eine reine Vertex-Verformung würde sichtbare Küste und Kollision
  auseinanderziehen. Bestehendes `coastPosition` bei der Zielhöhe mitrechnen.
  Außerdem nutzt `makeWorld` mit `pickV()` die globale Terrain-Vertexzahl für
  Platzierungen: Eine örtliche Formänderung kann deshalb trotz gleicher Seeds
  auch außerhalb der Bucht andere Positionen auswählen. Dies vor Übernahme
  prüfen; bei störenden Änderungen die Platzierungsbasis stabilisieren. Gleiche
  Zufallsfolge allein ist kein Nachweis unveränderter Vegetation.
- `world.js`, Bodenkarte: `gm[o+1]` ist derzeit unbenutzt; `r`, `b` und `a`
  enthalten Magenta-Bewuchs, Farbzone und Sand. Der freie Grünkanal kann die
  Buchtmaske aufnehmen. Gleiche Buchtenparameter für Dichtefeld und Bodenkarte;
  keine zusätzliche Zufallsfolge, welche die restliche Welt verändert.
- `shaders.js`, `W_SOLID`: `gm` wird schon gelesen. `gm.g`, Höhe und die
  ungestörte Flächennormale bestimmen Sand auf sanften Flächen; Steilwände
  behalten Stein. Vorhandene A/B/C-Texturwerte liefern feine Farbvariation;
  Felsfugen und grobe Bump-Normalen in den Sandzonen stark zurücknehmen.
  Trockener Sand heller/matter, Nasssaum dunkler mit zurückhaltendem Glanz.
  Bestehende Absorption und Kaustik können dann das hellere flache Wasser
  ergeben; das muss im Bildvergleich geprüft werden.
- Die Markierung nutzt die vorhandene RGBA8-Textur und deren schon ausgeführten
  Shaderzugriff: keine weitere Bilddatei, Textur, Instanzschicht oder Renderpass.
  Die Terrain-Dreieckszahl kann sich trotz gleich großem Raster ändern und muss
  gemessen werden. CPU-Aufbau, Kollisionsbytes und Laufzeit sind noch unbekannt.

**Bedienung:** Bei Augenhöhe +0,28 m liegt das tiefere Kollisionszentrum bei
−0,62 m, mit 0,5 m Radius reicht der Körper ungefähr bis −1,12 m. Eine sehr
flache Böschung stoppt den Spieler deshalb weit vor der sichtbaren Wasserlinie.
In einer idealisierten 10-%-Böschung wären das etwa elf Meter; dies ist eine
geometrische Abschätzung, keine Messung der Spielkollision. Für den ersten
Strandversuch bleibt der Unterwasseranstieg deshalb kurz; die flachere Sandbank
liegt überwiegend auf der trockenen Seite. Eine ausgedehnte watbare Flachzone
wäre eine eigene Bewegungsänderung und gehört nicht automatisch dazu.

Zuerst Form, Material und zugängliche Uferkante vergleichen: Gesamtansicht,
Annäherung, Wasserlinie, Unterwassersicht; identische Kameras/Zeiten in drei
Stufen. Dabei muss der akzeptierte, erreichbare Rand erhalten bleiben. Zusätze
wie Schaum, neue Pflanzen oder bewegte Wassergeometrie erst beurteilen, wenn
diese einfache Bucht bereits überzeugend aussieht. Sämtliche Kosten dieses
Entwurfs sind ungeprüft; nur die ungenutzte Datenkapazität ist im Code belegt.

## Unabhängiger Footprint-Review (18.11.2026)

Ein separat beauftragter Review-Agent hat den aktuellen Produktstand untersucht.
Zum Zeitpunkt dieses Reviews war keine dieser Optimierungen integriert. Statische Probebuilds wurden erneut
ausgeführt; Reproduktion mit `node experiments/surface/review-footprint.mjs`,
Ergebnisse in `results/footprint-review.json`. Dieser Lauf reproduziert zunächst
das aktuelle `index.html` bytegleich und misst die getrennten Kandidaten.
Keine neue Browser-, Heap-, Startzeit- oder GPU-Zeitmessung für diese Kandidaten.

Einordnung: Auftauchen einschließlich Uferkorrektur kostet gegenüber dem
Blattstand 2.865 HTML-Bytes, gzip 1.037 B und 786.272 B zusätzliche CPU-
Kollisionsarrays. Die rund 302 MiB lokalen Vergleichsartefakte sind separat;
darunter 358 ignorierte PNGs mit 310.673.703 B. Sie gehören nicht zur
ausgelieferten 103.118-B-Datei und wurden nicht gelöscht.

Priorisierte Ergebnisse:

| Priorität / Option | Belegtes Potenzial | Aufwand und Kosten | Prüfung / Risiko |
| --- | --- | --- | --- |
| 1. CPU-Kopien nach Upload freigeben | 2.846.672 B High/Medium; 2.625.928 B Low erreichbare Array-Nutzdaten | Klein; +27 B HTML, +27 B gzip | Mesh-Indexanzahl separat merken; alle Schatten-/Draw-Aufrufe umstellen. Kein gemessener RSS-Gewinn. |
| 2. Objekt-Indizes Uint16 | GPU-Puffer −541.248 B High/Medium, −475.548 B Low | Sehr klein; HTML gleich, gzip +3 B | Beide Objektindex-Bindungen umstellen; Terrain weiterhin Uint32. Alle Stufen prüfen. |
| 3. Über Wasser Null-Pässe überspringen | Strahl-, Blur- und Post-Arbeit für bereits null gesetzte Lichtstrahlen entfällt | Klein; +26 B HTML, +12 B gzip; GPU-Texturen bleiben für Abtauchen erhalten | GPU-Zeit unbekannt. Pass und Composite gemeinsam umstellen; Wasserlinienwechsel prüfen. |
| Separat: HTML mit bestehendem gzip-Loader packen | 103.118 → 58.342 B, −44.776 B / −43,42 % | Kleiner Build-Eingriff; keine Welt-/GPU-Speicherersparnis | JS nach Entpacken bytegleich; aktueller Browser-/Offline-Test fehlt. HTTP-gzip wird 964 B größer. |

**CPU-Kopien:** `main.js` hält über die weiterverwendeten Objekte `meshes` und
`Wd` noch Mesh-Vertex-/Indexarrays sowie `solids.data`, `bubbles`, `fish`,
`mantas` und `snow`. Nach dem Upload wird von den Mesh-Indizes nur die Anzahl
gebraucht; die übrigen genannten Inhalte werden nicht erneut gelesen. Die
Aufräumstelle bei `Wd.glints = Wd.volD ...` kann sie ebenfalls freigeben.
Mesharrays zählen 1.926.880 B High/Medium bzw. 1.706.136 B Low, die übrigen
Instanzarrays 919.792 B in jeder Stufe. GC-Zeitpunkt und Gesamtprozessspeicher
sind nicht gemessen. Temporäre `allV`, `allI` und `solidData` sind nicht zusätzlich
als dauerhafte Einsparung eingerechnet.

**Indizes:** Der Agent hat die aktuellen Meshgeneratoren für alle Stufen
ausgeführt; größter lokaler Index jeweils 29.357. Durch die ohnehin gesetzten
`baseVertex`-Offsets ist die große zusammengefasste Vertexzahl kein Hindernis.
CPU-Aufräumen und Uint16 zusammen kosten im Probebuild +27 B HTML/+30 B gzip.
Der GPU-Gewinn kommt hinzu; freigegebene CPU-Meshindizes nicht nochmals zählen.

**Oberwasser-Pässe:** `W_RAYS` setzt bei Kamera-y ≥ 0 das Strahl-RGB bereits
auf null, `render()` führt die Pässe dennoch aus, `W_POST` skaliert das Ergebnis
weiter hoch. Der statische Kandidat überspringt oberhalb Wasser sowohl die
beiden Pässe als auch die Strahladdition. Bei unverändertem Composite könnten
sonst alte Unterwasser-Strahlen sichtbar werden. Die Schleifen entsprechen bei
1280 × 720 etwa 6,22 Mio. nominellen `textureLoad`-Aufrufen pro Oberwasserbild;
das sind weder physische Speichertransaktionen noch gemessene Millisekunden.

Weitere vorhandene Kandidaten bleiben sinnvoll: `nearFly` mit Höhen-/Achsen-
Vorfilter (+28 B HTML im aktuellen Probebuild, ältere Messung etwa −369 ms
Weltaufbau) sowie die separate Entfernung der 80-MiB-Kopie durch `.slice(0)`
beim Dichtefeld-Readback. Der längere gemappte Buffer-Lebenszyklus muss beim
zweiten Kandidaten bewertet werden; 80 MiB weniger JS-Kopie bedeutet nicht
automatisch 80 MiB weniger Prozess-Spitzenspeicher.

Zunächst weder den reparierten Kollisionsradius noch die sichtbare Gegenküste
verkleinern. Vollständig gesättigte Wasser-/Felsbricks sind bereits über
Sentinelwerte komprimiert; weitere Brick-Redundanz ist ohne zusätzliche Analyse
unbekannt. Die aktuelle Kollision enthält 40.462 gemischte Bricks. Engeres
Packen könnte Speicher sparen, erhöht aber die Adressierungskomplexität und
müsste auch mit dem geplanten Strand funktionieren.

Empfohlener nächster Versuch: CPU-Aufräumen plus Uint16-Objektindizes, danach
separat die Oberwasser-Pässe messen. Alle drei Stufen, GPU-Pufferinhalte,
identische feste/zeitliche Bilder sowie Bewegung, Auftauchen, Uferzugang und
Audio prüfen. Erst nach diesen Nachweisen als Produktverbesserung übernehmen.

## Umsetzung: Speicherbereinigung und eine westliche Sandbucht (18.11.2026)

Nach Nutzerfreigabe wurden die ersten beiden Speicherempfehlungen und separat
eine einzelne Sandbucht in `source/` integriert; `index.html` ist regulär neu
gebaut. Die Bucht liegt am westlichen Rand, ungefähr bei x=−170, z=10. Die
Vergleiche verwenden den bereits akzeptierten Auftauch-/Ufer-/Blattstand,
nicht die eingefrorene Upstream-Referenz. Diese blieb unverändert.

### Speicher: konkrete Änderung und Nachweis

In `main.js` speichert jeder Mesh-Eintrag die benötigte Indexanzahl jetzt in
`m.ni`. Nach dem Zusammenfügen werden `m.vb` und `m.ib` freigegeben; Schatten-,
Fisch-, Manta- und normale Draw-Aufrufe verwenden die gespeicherte Anzahl.
Die vorhandene Aufräumstelle setzt auch `Wd.solids.data`, `bubbles`, `fish`,
`mantas` und `snow` auf `0`. `allI` und beide Objektindex-Bindungen verwenden
Uint16; Terrainindizes bleiben Uint32. Der höchste lokale Objektindex ist
29.357, die vorhandenen `baseVertex`-Offsets bleiben erhalten.

| Stufe | Freigegebene CPU-Array-Nutzdaten | Kleinerer GPU-Indexpuffer |
| --- | ---: | ---: |
| High / Medium | 2.846.672 B / 2,715 MiB | 541.248 B / 0,516 MiB |
| Low | 2.625.928 B / 2,504 MiB | 475.548 B / 0,454 MiB |

Dies sind gezählte Array-Nutzdaten bzw. angeforderte Puffergrößen, keine
Messung von Prozess-RSS, GC-Zeitpunkt oder Spitzenbedarf. Temporäre Upload-
Arrays werden nicht zusätzlich als dauerhafte Einsparung gezählt. Keine
separate Geschwindigkeitsverbesserung aus dieser Änderung nachgewiesen.

`memory-browser.json` und `memory-summary.json`: alle 136 Welt-/Mesh-/Index-
Hashes je Stufe gleich, darunter die kanonisch verglichenen hochgeladenen
Indexwerte. Genau ein GPU-Puffer halbiert, Texturdeskriptoren gleich. Je 41
feste Bildpaare: High und Medium vollständig pixelgleich; Low 40 pixelgleich,
im verbleibenden Bild ein Pixel mit einer 8-Bit-Farbstufe Abweichung. Kein
sichtbarer Unterschied bei der Sichtprüfung. Bewegung, Menü, Audio und
Offline-Nutzung bestanden. Die dekodierte Pixelprüfung ersetzt den zunächst
zu strengen PNG-Hash-Test; sie ist kein Nachweis allgemeiner Bildgleichheit
auf anderen Geräten.

### Strand: Form, Material und gemeinsame räumliche Abbildung

Der vorherige seitliche Blick zeigt eine durchgehende steile Felswand mit
groben Rillen bis zur Wasserlinie. Im identischen neuen Blick sind eine
niedrigere, weich ansteigende Sandsilhouette, eine größere ruhige helle Fläche
und ein dunkler feuchter Saum erkennbar. Der Sand setzt sich auf flachen Teilen
unter Wasser fort; steile Seiten bleiben felsig. Das ist eine ästhetische
Bewertung der Bilder, keine objektive Qualitätsmetrik. Die Bucht bleibt karg,
und unter Wasser sind die vorhandenen groben Felsformen weiterhin sichtbar.

Konkrete Umsetzung:

- `math.js`: `beachMask` grenzt eine einzelne Bucht ab. `coastOriginalY`
  invertiert die Höhenabbildung für das Kollisionsfeld.
- `shaders.js`: `coastShape` / `coastPosition` formen die bestehende Geometrie
  örtlich oberhalb −4 m um. Unterhalb davon bleibt die Form erhalten. Dieselbe
  Abbildung gilt für Schatten, Objekte, Pflanzen und Glanzpunkte. Die
  Topologie und die von Terrain-Vertexnummern abhängige Zufallsplatzierung
  bleiben so stabil. `coastNormal` berücksichtigt die geänderte Steigung auch
  unter Wasser und an Blättern. Blatt-Bewegungsparameter bleiben unverändert.
- `main.js`: Nur beim Aufbau der örtlichen oberflächennahen Kollisionsblöcke
  wird die Dichte an der invers abgebildeten Höhe gelesen. Die Entfernung wird
  mit dem dortigen Dichtegradienten normalisiert. Die obere Extrapolation
  schließt stetig an die bestehende oberste Rasterzeile an. Kein zweites
  Dichtefeld. Betroffene Culling-Untergrenzen werden konservativ abgesenkt,
  damit heruntergezogene Pflanzen/Steine nicht vorzeitig verschwinden.
- `world.js`: Die Maske belegt `gm[o+1]`, den bisher freien Grünkanal der
  vorhandenen Bodenkarte. Rot, Blau und Alpha bleiben bytegleich.
- `shaders.js`, `W_SOLID`: Sandfarbe, ruhige Bump-Normale und Glanz werden aus
  der vorhandenen Maskenprobe, Höhe, Flächenneigung und Texturwerten abgeleitet.
  Felsrillen und grobes Detail-AO werden dort zurückgenommen. Keine neue
  Texturprobe für die Maske. `vol` liest das vorhandene Lichtvolumen an der
  invers abgebildeten Position; das ist eine Näherung mit wiederverwendeter
  Beleuchtung und keine neue physikalische Lichtberechnung.

### Gemessener Footprint

| Größe | Vor Speicherbereinigung | Mit Bereinigung | Mit Strand |
| --- | ---: | ---: | ---: |
| HTML | 103.118 B | 103.145 B | 105.121 B |
| gzip | 41.628 B | 41.658 B | 42.433 B |
| CPU-Kollision CI + CG | 3.204.608 B | 3.204.608 B | 3.216.896 B |

Der Strand allein kostet 1.976 B HTML, 775 B gzip und 12.288 B CPU-
Kollisionsdaten. Alle 40 GPU-Puffer- und 17 Texturdeskriptoren entsprechen dem
optimierten Stand ohne Strand. Keine zusätzlichen Dreiecke, Instanzen oder
Renderpässe. Neue Shaderarithmetik und einmalige CPU-Abbildung entstehen
trotz unveränderter Puffergrößen. Beide Änderungen zusammen kosten 2.003 B
HTML; netto bleiben 2.834.384 B CPU-Nutzdatenersparnis auf High/Medium bzw.
2.613.640 B auf Low, zusätzlich zur GPU-Indexersparnis.

**Warum 12 KiB Kollision trotz gesperrtem Landgang?**
`beach-collision-layers.json` zählt 192 zusätzliche gemischte 4×4×4-Blöcke
à 64 Byte. 191 davon liegen in der Abtastschicht −2 bis +0,25 m, einer in
−5 bis −2,75 m. Sie entstehen fast vollständig am neuen Unterwasserhang.
Die Schicht +1 bis +3,25 m wird schon vorher und weiterhin nicht gespeichert.
Es handelt sich also nicht um einen neu angelegten Collider für begehbares
trockenes Land. Eine analytische oder zweidimensionale Sperrkurve wäre möglich,
müsste aber Abtauchen und schräge Annäherungen konsistent abbilden. Für 12 KiB
lohnt der zusätzliche Sonderfall derzeit wenig; die vorhandene räumliche
Kollision bleibt erhalten. Die frühere pauschale 150-m-Sperre wird nicht
wieder eingeführt.

### Bild-, Bewegungs- und Bedienungsprüfung

`beach-browser.json`: 6 Fälle, 48 Bilder je Version/Stufe, insgesamt 288.
Davon je Stufe 45 Vorher-nachher-Paare bei identischen Kameras, 1280×720,
Renderauflösung und Animationszeit. Enthalten sind tiefe Gesamt-/Detailblicke,
Oberwasser, Strand aus vier Richtungen/Entfernungen, Wasserlinienübergänge
und eine 16-Bilder-Sequenz in 30-Hz-Schritten sowie zwei spätere Wellenphasen.
Die drei Bilder der tatsächlich erreichten Uferpositionen pro Variante sind
separat: Ihre Kameras unterscheiden sich wegen der neuen Geländeform.

Sichtprüfung der Nah-/Gesamtansichten und der zeitlichen Kontaktbögen:
Sandfläche, Nasssaum und Wellen bleiben zusammenhängend; kein offensichtliches
Flackern oder Aufpoppen in diesen Stichproben. Grenzen: kurze Sequenzen und
ein einzelner Mac/Chrome 157, keine allgemeine Artefaktfreiheit zugesichert.
135 Daten-Hashes geprüft, 130 unverändert. Änderungen beschränken sich auf
CI/CG, Bodenkarte und zwei konservativ erweiterte Culling-Untergrenzen.
Terrain-/Mesh-/Platzierungsarrays sind unverändert, sichtbare Positionen in der
Bucht ändern sich durch die Shaderabbildung.

Je Version/Stufe 90 Wege à 600 Physikschritte: 80 radiale Anläufe in 16
Richtungen/fünf Starttiefen sowie zehn gezielte Anläufe auf die Bucht. Kein
Landgang, Durchdringen oder Verlassen des Randes in diesen Tests; geringster
gemessener Feldabstand 0,442 m. Westlicher Oberflächen-Endpunkt von x=−168,407
auf −169,694 m: der Spieler kommt weiterhin bis an die Küste. Ringprüfung in
720 Richtungen bei 178 m, Höhen −52 bis +0,25 m. Diese Physikreihen rendern
nicht zwischen den Schritten; zeitliche Bilder sind ein separater Test.
Tiefe Referenzbewegung unverändert. `beach-shipping.json` bestätigt den
normalen Offline-Build in allen drei Stufen mit Audio, Menü und Bewegung.
Test-Chrome verwendet ein eigenes Profil und unterdrückt Pointer Lock.

Der Strand bleibt als isoliert rücknehmbarer Versuch integriert, weil die
Form-/Materialänderung im festen Bildvergleich klar erkennbar ist und keine
zusätzlichen GPU-Puffer oder Texturen erfordert. Speicher der übersetzten
Shader wurde nicht gemessen. Allgemeine Fotorealistik, korrekte
Uferspiegelung und neu berechneter Lichttransport sind damit nicht erreicht.
Die geprüften Varianten, Rohdaten und Rückwege liegen unter
`experiments/surface/`; `beach-compare.html` ist die lokal erzeugte Galerie.

Für Rücknahme zuerst `beach-only.patch` umkehren. Danach kann der aktualisierte
`surface-only.patch` Auftauchen und Uferkorrektur entfernen und erhält die
Speicher-, Blatt- und Materialänderungen. `memory-only.patch` nimmt die
Speicheränderung separat zurück. Diese Kombinationen wurden in temporären
Quellkopien geprüft; Produktquellen wurden dafür nicht zurückgesetzt.
Keine neuen Commits oder Pushes in diesem Versuch.

### Separate Zeitmessung nach dem Standby

`beach-timing.json` / `beach-summary.json`, vollständiger Lauf ab
18.11.2026, 15:59 UTC auf diesem Mac mit Chrome 157. Je Variante/Stufe eine
Aufwärmseite, danach drei Messseiten in wechselnder Reihenfolge. Vier feste
Kameras, jeweils 20 Aufwärm- und 120 Messframes. Verglichen wird der bereits
speicheroptimierte Stand ohne/mit Strand. Gleiche 1280×720-Auflösung. Die
vorherigen Läufe `beach-timing-standby.json` und `beach-timing-interrupted.json`
sind wegen Standby bzw. Browser-Timeout vollständig ausgeschlossen. Ein
weiterer Startversuch innerhalb der Sandbox erreichte keinen Browser-Endpunkt;
er liefert keine Messdaten. Der erfolgreiche Lauf nutzte ein eigenes temporäres
Chrome-Profil außerhalb der Sandbox, weiterhin ohne Pointer Lock.

| Stufe | Bis Menü/erstem Bild vorher → Strand | Differenz der Mediane | Kollisionsaufbau vorher → Strand |
| --- | ---: | ---: | ---: |
| High | 2.391,2 → 2.497,2 ms | +106,0 ms | 74,6 → 126,2 ms |
| Medium | 2.254,7 → 2.345,2 ms | +90,5 ms | 74,8 → 127,9 ms |
| Low | 2.210,7 → 2.287,5 ms | +76,8 ms | 74,3 → 129,4 ms |

Der lokale inverse Kollisionsaufbau kostet in diesem Vergleich einmalig
rund 52–55 ms mehr. Die gesamte Startzeit schwankt stärker: High vorher
2.370,7–2.477,6 / danach 2.433,6–2.507,9 ms; Medium 2.240,1–2.414,8 /
2.335,2–2.461,8 ms; Low 2.194,8–2.222,2 / 2.280,8–2.446,3 ms. Kein Nachweis
für kalte Shaderübersetzung oder andere Rechner.

GPU-Zeit: Median der drei Framezeit-Mediane pro Ansicht. Die Spalten zeigen
jeweils **vorher → Strand (Differenz)** in Millisekunden.

| Stufe | Tiefe Ansicht 1 | Tiefe Ansicht 6 | Oberwasser Mitte | Strand nah |
| --- | ---: | ---: | ---: | ---: |
| High | 11,076 → 11,272 (+0,197) | 8,192 → 8,389 (+0,197) | 9,175 → 9,306 (+0,131) | 1,868 → 2,163 (+0,295) |
| Medium | 8,847 → 8,913 (+0,066) | 6,947 → 7,078 (+0,131) | 7,078 → 7,209 (+0,131) | 1,507 → 1,769 (+0,262) |
| Low | 3,473 → 3,539 (+0,066) | 2,490 → 2,556 (+0,066) | 2,556 → 2,621 (+0,066) | 0,786 → 0,786 (0,000) |

Das ist zusätzlicher Renderaufwand, keine Performanceoptimierung. Bei High
und Medium schwankt eine komplette Messrunde stark: High-Ansicht 1 liegt
vorher zwischen 11,076 und 17,760 ms, danach zwischen 11,207 und 17,727 ms.
Die kleinen tiefen Ansichts-Differenzen sind deshalb kein belastbares
allgemeines Kostenlimit. An der nahen Bucht ist der Mehrbedarf konsistenter:
High 1,835–1,901 → 2,163–2,556 ms; Medium 1,442–1,507 → 1,769–1,835 ms.
Low-Gleichheit liegt innerhalb der groben Zeitstempelauflösung; sie beweist
keinen kostenlosen Shader. CPU-Zeit pro Renderaufruf bleibt bei den gemessenen
Medianen 0–0,1 ms und ist damit hier zu grob für eine feine Aussage.

Bewertung: Der lokale Form-/Materialgewinn rechtfertigt diesen kleinen,
sichtbaren Versuch, die Zahlen sprechen aber gegen eine ungeprüfte Verteilung
derselben Abbildung über die ganze Küste. Vor zusätzlichen Buchten wäre die
Normalen-/Höhenarithmetik zu vereinfachen oder ihre Verwendung enger zu
begrenzen. Der vorhandene Versuch bleibt separat rücknehmbar.

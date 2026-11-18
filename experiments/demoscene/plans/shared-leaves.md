# Gemeinsame Nah-/Fern-Blattdaten

**Empfehlung: Go fuer einen isolierten Versuch mit 72-Byte-Instanzschritt und einem Fern-Draw pro sichtbarer Zelle.** Der erste Versuch braucht weder Storage-Bindings noch eine Indexliste und laesst Nah-/Mitteldistanz, Schatten, kleine Pflanzen und alle Generatorwerte unveraendert. Die wichtigste offene Frage ist, ob mehr Fern-Draws und weniger zusammenhaengende Speicherzugriffe die GPU-/CPU-Zeit merklich erhoehen. Erst bei bestandener Daten-, Bild- und Zeitpruefung uebernehmen.

Stand: 18.11.2026, Baseline `3178034`. Planung auf Basis von `source/` und `experiments/surface/results/beach-browser.json`; keine Produktdateien geaendert, keine Browser-/GPU-Last gestartet. Die eingefrorene Optimierungsreferenz bleibt unberuehrt.

## 1. Was derzeit redundant ist

`source/src/world.js:327` packt jedes grosse Blatt in 36 Byte: acht Float32-Werte und vier unorm8-Werte. `pack(big, 2, 1.5)` bei Zeile 390 legt eine zweite Darstellung an. Pro Zelle werden die urspruenglichen Eintraege 0, 2, 4, ... uebernommen; allein die Breite wird mit 1,5 multipliziert. Auch Stiele (`type == 1`) unterliegen dieser zweiten Auswahl und Breitenmultiplikation. Die vorgelagerte qualitaetsabhaengige THIN-Auswahl bleibt davon getrennt.

`main.js:315` laedt beide Puffer hoch. `main.js:497-500` nutzt den ersten fuer 0-24 und 24-58 m, den zweiten fuer 58-150 m; die Entfernungen skalieren wie bisher mit `det`. Das Culling waehlt Zellen anhand ihrer Flaechenentfernung, nicht einzelne Blattwurzeln. `drawCells()` fasst benachbarte sichtbare Zellen innerhalb einer Reihe zusammen. Der Schattenpass zeichnet nur den vollstaendigen Nahpuffer.

Wichtig fuer die Praezision: Die aktuelle pack-Schleife schreibt zuerst die acht Werte in `Float32Array` und fuehrt erst danach `f[k * 9 + 6] *= wm` aus. Die bestehende Fernbreite ist bereits **f32(f32(originalWidth) * 1.5)**. Eine Multiplikation des geladenen Nahwerts im Shader entspricht genau diesem beabsichtigten Rundungsablauf. Trotzdem GPU-Reassoziierungen und Pixelabweichungen gesondert pruefen.

## 2. Kleinster konkreter Patchplan

### world.js: Fernmetadaten erhalten, Far-Array nicht mehr erzeugen

Die vorhandene pack-Funktion um einen ausdruecklichen Metadatenmodus erweitern. Der Aufruf fuer `bigF` durchlaeuft weiter genau die ausgewaehlten Originaleintraege, erzeugt jedoch nur `{ n, start, lo, hi }` und keinen `buf`. Die Nah-/Small-Aufrufe behalten ihren bisherigen Codepfad und ihre Bytes.

`bigF.start` zaehlt wie bisher `ceil(Zellenblattzahl / 2)`. `bigF.lo/hi` weiterhin aus den originalen JavaScript-Zahlen `a[i + 1]` und `a[i + 3]` berechnen. Nicht aus den gerundeten Float32-Nahdaten ableiten: Das koennte Culling-Grenzen verschieben. Die lokale Strandkorrektur in main.js muss `Wd.bigF.lo` weiterhin bearbeiten. Ein globales halbiertes `Wd.big.start` ist ohne Padding falsch, weil die Auswahl an jeder Zelle neu bei 0 beginnt.

### main.js: zweite Ansicht auf den bestehenden Vertexpuffer

Eine Blatt-Vertexbeschreibung fuer die Fernpipeline mit denselben Attributen, aber `arrayStride: 72` anlegen. `stepMode` bleibt `instance`, Attributoffsets bleiben 0, 16, 32. `pLeafF` verwendet diese Beschreibung; alle anderen Pipelines behalten Stride 36. Die separate GPU-Allokation `ibBigF` entfaellt. `ibBig` braucht weiterhin nur `VERTEX | COPY_DST`.

`drawCells` um einen expliziten optionalen Fernmodus erweitern. Fuer normale Aufrufe bleibt die bestehende Zusammenfassung zu Laeufen unveraendert. Im Fernmodus nach derselben Sichtbarkeitsentscheidung jede sichtbare Zelle einzeln zeichnen:

```js
const first = Wd.big.start[c];
const count = Wd.bigF.start[c + 1] - Wd.bigF.start[c];
const cellBytes = (Wd.big.start[c + 1] - first) * 36;
if (count) {
  r.setVertexBuffer(0, ibBig, first * 36, cellBytes);
  r.draw(6, count, 0, 0);
}
```

Keinen zusaetzlichen zweiten Culling-Durchlauf mit abweichenden Regeln schreiben. `rowOrd`, Frustumtests, 58/150, `det`, `bigF.lo/hi` und Randmarge 5 bleiben gleich. Innerhalb jeder Zelle bleibt die alte Fernreihenfolge erhalten. Nach dem Fernpass bindet der bestehende Small-Pass `ibSmall` neu; damit kein Offset in den naechsten Draw uebertragen wird.

Die bisherigen globalen `bigF.start`-Werte duerfen hier **nicht** als `firstInstance` an `draw()` uebergeben werden: Der Zellanfang ist schon durch den Byteoffset eingerechnet. `firstInstance = 0` ist bei dieser Variante zwingend.

### shaders.js: nur Fernbreite rekonstruieren

In W_LEAF einen Pipeline-Override, beispielsweise `WIDTH: f32 = 1.`, ergaenzen. Nur `pLeafF` bekommt `WIDTH: 1.5`. Im Vertexshader einmal `let wid = i.b.z * WIDTH;` bilden und die drei bestehenden Breitenverwendungen (`ruf`, normale Breite, Schattenbreite) auf `wid` umstellen. Alle anderen Formeln und Overrides bleiben unveraendert. Bei WIDTH=1 soll der Compiler die Multiplikation entfernen; das ist keine gemessene Laufzeitgarantie.

Insbesondere Biegung, Phase, Stroemung, Reihenanzahl 9/5/3, Konturschnitt, Alpha-to-Coverage, `FAR`, Schattenmaske und Strandverformung nicht gleichzeitig anfassen. Es werden keine neuen Zufallszahlen erzeugt.

## 3. Letzte ungerade Zelle und Buffer-Validierung

Mit N Nahblaettern in einer Zelle ist M = ceil(N/2). Der letzte Fernzugriff endet nach `(M - 1) * 72 + 36` Byte. Bei ungeradem N ist dies exakt `N * 36`, bei geradem N bleiben 36 unbenutzte Byte am Ende. Daher ist auch die letzte ungerade Zelle ohne Padding zulaessig. N=0 wird uebersprungen; N=1 benoetigt exakt 36 Byte.

Ein Binding ohne `size` wuerde bis zum Pufferende reichen und ist ebenfalls ausreichend; eine explizite Zellrange ist fuer den ersten Versuch besser, weil falsche Instanzzahlen nicht unbemerkt in die naechste Zelle hineinlesen. Offset 36*first und Stride 72 sind durch 4 teilbar. Die relevanten Regeln stehen in [WebGPU: setVertexBuffer und draw](https://gpuweb.github.io/gpuweb/#render-commands) sowie [Vertexbuffer-Layouts](https://gpuweb.github.io/gpuweb/#dictdef-gpuvertexbufferlayout): Der letzte Zugriff richtet sich nach dem Ende des letzten Attributs, hier 36 Byte, und muss nicht einen vollen 72-Byte-Schritt enthalten.

Ein statischer Test mit der **unveraenderten, aus world.js extrahierten pack-Funktion** lief ohne Browser: 256 synthetische Zellen mit 0 bis 255 Blaettern, insgesamt 32.640 Nah- und 16.384 Fernblaetter. Rekonstruktion ueber 72-Byte-Schritte plus Float32-Breitenmultiplikation war fuer alle 16.384 Records bytegleich zum bisherigen Fernpuffer. Alle Zellranges erfuellten die obige Bedingung; letzte Zelle N=255: 9.180 Byte benoetigt und vorhanden. Das prueft die Adressierungs-/Rundungsidee, noch nicht GPU-Ausfuehrung oder echte Weltdaten.

## 4. Belegbare Groessen und offene Kosten

Die Zahlen stammen aus den existierenden High-/Medium-/Low-Allokations-/Weltdatenberichten der aktuellen Produktversion. Die neue Implementierung wurde noch nicht gebaut.

| Stufe | Nahblaetter | Fernblaetter | Entfallender Fernpuffer / GPU-Ersparnis | Gleiche Fernmetadaten auf CPU |
| --- | ---: | ---: | ---: | ---: |
| High | 1.340.077 | 670.083 | 24.122.988 B / 23,005 MiB | 3.076 B |
| Medium | 707.558 | 353.816 | 12.737.376 B / 12,147 MiB | 3.076 B |
| Low | 391.319 | 195.701 | 7.045.236 B / 6,719 MiB | 3.076 B |

- **CPU dauerhaft:** kein entsprechender weiterer Gewinn, weil der bisherige Far-Array nach Upload schon freigegeben wird. Die Metadaten bleiben.
- **CPU waehrend Aufbau:** der Far-Array und sein Befuellen entfallen. Das reduziert diese zeitweiligen Array-Nutzdaten um die Tabellenwerte, ist aber keine gemessene Prozess-Spitzenersparnis. Die grossen JavaScript-Generatorlisten bleiben vorerst bestehen.
- **GPU dauerhaft:** genau eine Vertexpuffer-Allokation entfaellt, keine neue Textur und keine Ersatzallokation. Die anderen Puffer bleiben bytegleich.
- **HTML/gzip:** noch zu messen. Weniger Pack-/Uploadcode, dafuer Stride-Beschreibung, Fern-Draw-Zweig und Override; netto nicht vorhersagen.
- **Startzeit:** weniger Schreib-/Uploadarbeit ist plausibel, genaue Millisekunden offen.
- **Renderkosten:** Ferninstanzzahl und Vertexzahl unveraendert; ein zusaetzliches Breitenprodukt pro Vertex, vermutlich konstant optimierbar. Mehr Draws/Bindings: maximal eine Drawgruppe je sichtbarer Zelle statt je zusammengefasstem Lauf. Der feste Vertex-Fetch bleibt erhalten, liest aber jeden zweiten 36-Byte-Datensatz. Hardware kann dadurch mehr Cachelines pro nutzbarem Blatt lesen. Kein FPS-Gewinn voraussetzen.

## 5. Alternativen, falls die einfache Route zu teuer rendert

### A. Storage-Puffer plus 4-Byte-Verweisliste

Nahdaten weiter im vorhandenen 36-Byte-Puffer halten, zusaetzlich STORAGE-Usage. Ferninstanzen sind eine dichte Uint32-Liste: je Zelle `big.start[c] + 2*j`. Bisherige Far-start/lo/hi und zusammengefasste Draws bleiben unveraendert. Eine separate Fern-Vertexfunktion liest mit `instance_index` bzw. einem Instanzattribut den Verweis, dann neun u32 aus dem Nahpuffer; acht Felder per Bitcast, das letzte per unorm8-Entpacken. So vermeiden wir WGSL-Struct-Padding: `array<struct { vec4f, vec4f, u32 }>` haette nicht automatisch 36 Byte Stride.

| Stufe | Neue Verweisliste | GPU-Ersparnis gegen aktuellen Stand |
| --- | ---: | ---: |
| High | 2.680.332 B | 21.442.656 B / 20,449 MiB |
| Medium | 1.415.264 B | 11.322.112 B / 10,798 MiB |
| Low | 782.804 B | 6.262.432 B / 5,972 MiB |

Dies benoetigt ein neues Far-Pipelinelayout bzw. Bindgroup, einen Read-only-Storagebuffer und ggf. den Indexbuffer als Storage. Vorher echte `device.limits` pruefen. Der groesste Nahpuffer ist 48.242.772 B und liegt unter dem 128-MiB-Standardlimit einer einzelnen Storage-Bindung; Offset 0 vermeidet Alignmentprobleme. [WebGPU-Limits](https://gpuweb.github.io/gpuweb/#limits) und [WGSL instance_index](https://gpuweb.github.io/gpuweb/wgsl/#instance-index-builtin-value).

Mehr Shaderloads/Adressierung, geaenderter Fetch-/Cachepfad, unorm-Entpacken und wiederholte Zugriffe fuer alle sechs Vertices muessen gemessen werden. Nicht zugleich Nah- oder Schattenpfad auf Storage umstellen. Diese Variante ist umfangreicher und spart weniger als der Stride-Ansatz, kann aber dessen zusaetzliche Draw-Aufrufe vermeiden.

### B. Pro Zelle ein degeneriertes Padding-Blatt bei ungerader Anzahl

Bei gerader Zelllaenge gilt global `near.start[c] == 2 * far.start[c]`. Ein 72-Byte-Fernlayout koennte dann wieder die bisherigen zusammengefassten Laeufe verwenden. Nach jeder ungeraden Zelle genau einen Null-Laengen-/Null-Breiten-Stiel anhaengen; er wird im Nah-/Schattenpass degeneriert, vom Fernpass als ungerader Eintrag uebersprungen. Bounds weiterhin ohne Padding berechnen.

Die jetzigen Counts implizieren 89/74/83 ungerade Zellen auf High/Medium/Low. Zusatz nur 3.204/2.664/2.988 Byte; GPU netto 23,002/12,145/6,716 MiB weniger. Diese Variante hat gute Aussichten bei Draw-Overhead, veraendert aber Nahpufferlayout und Instanzzahlen. Degeneration im **gesamten** bestehenden Bewegungs-/Schatten-/Strandpfad beweisen und pruefen, keine nur vermeintlich unsichtbaren Dummy-Dreiecke zulassen. Deshalb als zweite Variante, nicht im ersten Versuch.

### C. Gerade/ungerade Blaetter umsortieren

Ausgewaehlte Fernblaetter zuerst in jede Zelle schreiben. Dadurch werden Fernzugriffe dichter, aber die Nahreihenfolge aendert sich, und Far-Zellbereiche bleiben ohne gesonderte Draws oder Verweise nicht global zusammenhaengend. Kein Vorteil fuer den kleinsten exakt vergleichbaren Versuch; nicht priorisiert.

## 6. Pruefplan und Uebernahmekriterien

1. **Varianten isolieren.** Baseline aus Commit 3178034; Variante nur dieser Plan. Eigene Build-/QA-/Timingdateien unter experiments/demoscene, keine historischen Resultate ueberschreiben. Stride und Schatten16/Quantisierung nicht gleichzeitig vergleichen.
2. **Echte Daten einmal beweisen.** In QA vor Freigabe der Listen alten Fernpuffer als Referenz berechnen. Alle rekonstruierten 36-Byte-Fernrecords bytegleich vergleichen, einschliesslich Stielen/Farbbytes/Breite. `start/lo/hi/n` unveraendert. Alle sonstigen Welt-/Mesh-/Kollisionshashes unveraendert. Produktionsvariante darf den Referenzpuffer nicht enthalten. Synthetisch 0/1/2/ungerade/gerade sowie letzte Zellrange testen.
3. **Drawlisten vergleichen.** Testinstrumentierung protokolliert Originalblatt-IDs je Draw. Fuer denselben Frame identische geordnete Menge ausgewaehlter Far-IDs; nur Gruppierung darf sich aendern. Sichtbare Instanz-/Dreieckszahl gleich. Keine neue Schatteninstanz. Draw- und Bindinganzahlen separat zaehlen.
4. **Feste Bilder auf drei Stufen.** 1280x720, gleiche Renderaufloesung/det/Kamera/Zeit, sechs Tiefenansichten, Blatt-Nahansichten, Oberwasser und Sandbucht. Schattenbild besonders geeignet: es soll von dieser Variante nicht beeinflusst werden. Erst Pixelvergleich, dann visuelle Einordnung geringster Unterschiede, keine pauschale Toleranz fuer grossflaechige Fehler.
5. **LOD und Zellen gezielt.** Kamerafahrten um die tatsaechlichen Zell-Culling-Schwellen bei 24, 58 und 150 m, auf beiden Seiten und diagonal zu Zellgrenzen, auch mit det<1. Die letzte Testposition allein reicht nicht: Sequenzen mit fester Zeit und danach 30/60-Hz-Zeitfortschritt, um veraenderte Auswahl, Breite, Popping oder Phasenspruenge zu erkennen. Far-Grenzen nicht nur anhand Entfernung zum einzelnen Blatt testen.
6. **Zeit und Speicher getrennt.** Ein Warmup plus mindestens drei wechselnde Laeufe pro Stufe, gleiche Nah-/Fern-lastige Ansichten. CPU-Submission und GPU-Zeit messen, Standby-Runden ausschliessen. Entfallende API-Puffergroesse nachweisen; keine RSS-Aussage daraus ableiten.
7. **Produktpruefung.** Normaler offline HTML-Build auf High/Medium/Low, Audio/Menue/Bewegung, Auf-/Abtauchen. Keine WebGPU-/JS-Fehler. Test-Chrome mit eigenem Profil und unterdruecktem Pointer Lock.

Uebernehmen nur bei erhaltener Blattidentitaet und sichtbarem Verhalten. Ein reproduzierbarer Zeitnachteil verlangt einen bewusst bezifferten Speicher-/Zeitkompromiss oder eine zweite isolierte Route; er ist nicht durch kleinere Puffer automatisch gerechtfertigt. Rueckweg ueber separaten Patch/Commit ohne Ruecknahme des Strandes, Auftauchens oder der bestehenden Speicherbereinigung.

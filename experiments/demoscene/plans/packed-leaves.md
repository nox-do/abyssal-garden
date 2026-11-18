# Plan: Blattparameter verdichten

**Empfehlung: Go fuer einen isolierten 24-Byte-Versuch. Kein Go fuer die naive
20-Byte-Version.** Nur Datenlayout und dessen Decode aendern, nicht Generator,
Blattzahl, LOD-Auswahl, Bewegungsformeln oder Konturmaske. Produktstand `3178034`.
Dieser Plan implementiert nichts und startet keine Browser-/GPU-Pruefung.

Die vermeintlich beliebig quantisierbaren Parameter `yaw` und `hA` haben im
aktuellen Shader zwei empfindliche Verwendungen. Deshalb bleiben beide als
Float32 erhalten. Sechs andere Floats werden zu passend skalierten UNORM16-
Werten. Die vier bereits gepackten Bytes bleiben bytegleich.

## Befunde im aktuellen Code

- `source/src/world.js:94` sammelt je Blatt zwoelf Werte; die ersten acht sind
  x, y, z, Laenge, yaw, tilt, Breite, hA. Danach folgen Typ, zwei Seeds und
  Biegung. Die Blattzahl-/Qualitaetsauswahl findet dort bereits statt.
- `world.js:327` (`pack`) schreibt 36 B: acht Float32 und vier UNORM8.
  `pack(big, 2, 1.5)` erzeugt die Fernvariante; ihre Breite wird NACH der ersten
  Float32-Rundung um 1,5 vervielfacht und wieder als Float32 gespeichert.
- `main.js:81` definiert `ibLeaf`. Dieselbe Beschreibung wird fuer nahe,
  mittlere, ferne, kleine Blaetter und den Blatt-Schatten verwendet.
- `shaders.js:450` (`W_LEAF`) rekonstruiert bereits die Geometrie pro Vertex.
  Der gewuenschte Versuch veraendert nur die Eingabewerte davor.
- Die drei aktuellen Blattpuffer enthalten zusammen auf High 2.837.372,
  Medium 1.475.046 und Low 793.883 Datensaetze. Das schliesst die bestehende
  Fernkopie ein; es sind nicht alles unterschiedliche Pflanzen.

### Warum yaw exakt bleiben muss

`shaders.js:496` waehlt mit
`step(hs(s1 * 91.7 + s2 * 37.1 + i.b.x), pr.x)` die glitzernden Blaetter.
`hs` ist `fract(sin(x * 127.1) * 43758.5453)`. Kleine Aenderungen an yaw
koennen dadurch die Glitzerzuordnung stark veraendern. Auch eine geometrisch
aequivalente Normalisierung modulo 2 pi waere hier nicht aequivalent.
Yaw ist ausserdem nicht allgemein in [0, 2 pi]: Wandbueschel verwenden
`atan2 + Zufall`, kleine Bueschel addieren weitere Winkel und Kelpstengel
addieren Hoehenverdrillung. Im ersten Versuch yaw unveraendert Float32 lassen.

### Warum auch hA exakt bleiben muss

`hA` geht in die zeitabhaengige Biegung `kq` ein. Anschliessend setzt
`select(kq, .06, abs(kq) < .06)` kleine negative Werte auf POSITIVE .06.
An kq = -.06 liegt somit eine bestehende Unstetigkeit. Ein gerundetes hA
kann ihren Umschaltzeitpunkt verschieben. In der ungestoerten Mittellinie
betraegt die dortige seitliche Sprunggroesse ungefaehr 0,06 * Blattlaenge,
bei 3,2 m also bis etwa 19 cm. Das ist kein neu gefundener Bildnachweis,
sondern die analytische Differenz der beiden Grenzformeln. Die bestehende,
vom Nutzer akzeptierte Bewegung soll erhalten bleiben: hA beibehalten,
nicht bei dieser Speicherarbeit die Bewegungsfunktion reparieren.

`s1`, `s2` und Biegung beeinflussen ebenfalls Hashes, Frequenzen und diese
Verzweigung; ihre bisherigen vier Byte bleiben deshalb exakt gleich.

## Konkretes 24-Byte-Layout

| Offset | WebGPU-Format | Inhalt | Decode |
| --- | --- | --- | --- |
| 0 | `unorm16x4` | x, y, z, Laenge | * (384,72,384,4) + (-192,-64,-192,0) |
| 8 | `unorm16x2` | tilt, Breite | * (pi,2) |
| 12 | `float32x2` | yaw, hA | identisch zur Baseline |
| 20 | `unorm8x4` | Typ, s1, s2, Biegung | identisch zur Baseline |

`arrayStride:24`, `stepMode:'instance'`; vier Attribute statt drei, alle
Offsets passend ausgerichtet. Die Dekodierung bleibt in WGSL f32. Es wird
kein `shader-f16`-Feature, kein Storage-Buffer und keine neue Textur gebraucht.
Normierte 16-Bit-Vertexformate und die Konvertierung zu f32 sind Teil von
[WebGPU Vertex Formats](https://gpuweb.github.io/gpuweb/#vertex-formats).

Skizze fuer `W_LEAF.vs`:

```wgsl
struct LI {
  @location(0) a: vec4f,
  @location(1) dims: vec2f,
  @location(2) stable: vec2f,
  @location(3) c: vec4f
};
struct LeafValues { a: vec4f, b: vec4f, c: vec4f };
// Am Anfang von vs(..., raw: LI):
let i = LeafValues(
  raw.a * vec4f(384.,72.,384.,4.) + vec4f(-192.,-64.,-192.,0.),
  vec4f(raw.stable.x, raw.dims.x * 3.141592653589793,
        raw.dims.y * 2., raw.stable.y),
  raw.c
);
```

Danach bleibt der existierende Blattcode mit `i.a`, `i.b`, `i.c` gleich.
`vsGl` hat eigene Eingaben und darf nicht mit umgestellt werden.

### Host-Packer

1. `pack()` behaelt Zellreihenfolge, `step`, Anzahl, `start`, `lo`, `hi`.
2. Statt `n*36` direkt `n*24` anlegen; keine grosse 36-B-Zwischenkopie.
3. Vor jeder Quantisierung den Baseline-Float32-Wert herstellen. Fuer die
   Fernbreite ist das `Math.fround(Math.fround(a[i+6]) * wm)`.
4. UNORM16: `round((value-min)/range * 65535)`. Im Versuch ausserhalb des
   festgelegten Bereichs HART fehlschlagen, nicht still clampen.
5. yaw und hA ueber eine Float32-Sicht an Offset 12/16 schreiben.
6. Die vier Bytes wie bisher mit Uint8-Zuweisung schreiben, also insbesondere
   keine neue Rundung statt der bisherigen Trunkierung fuer Seeds/Biegung.

Der Packer soll keine Zufallszahl verbrauchen. Weltgenerierung, Absorptions-
volumen, Bodenkarte, Kollisionsfeld und alle nicht betroffenen Puffer bleiben
bytegleich. Die bisher grossen JS-Zwischenlisten bleiben in diesem Versuch;
deren Entfernung ist eine andere Start-/Spitzenspeicheroptimierung.

## Wertebereiche und Fehlerbudget

Die folgenden Bereiche sind aus den Generatoren abgeleitete sichere Hüllen,
keine neu gemessenen Minima/Maxima. Vor Uebernahme alle tatsaechlichen Datensaetze
der drei Stufen pruefen und Extremwerte protokollieren.

| Wert | Zu pruefende Huelle | Grund |
| --- | --- | --- |
| x/z | [-192,192] m | Generator ueberwiegend innerhalb Radius 170/172; Stengelneigung und Offsets haben Reserve |
| y | [-64,8] m | Dichtefeld -56 bis 3,25 m, kleine Wurzeloffsets; obere Reserve |
| Laenge | [0,4] m | Haengeblaetter maximal 3,2 m, Cluster maximal 3 m, Stengel 2,1 m |
| tilt | [0,pi] | Haengeblaetter bis pi, Wand-/Bodenblaetter darunter |
| Breite | [0,2] m | beinhaltet Low-Verbreiterung *2 und Fernbreite *1,5; Kelpobergrenze etwa 1,45 m |
| yaw | Float32 unveraendert | negative Winkel und Werte ueber 2 pi sind vorhanden |
| hA | Float32 unveraendert | Kelp bis <42 m, Cluster 0/0,5/1,5/2,5; bestimmt Bewegungsphase |

Maximaler reiner Rundungsfehler bei Rundung zum naechsten UNORM16-Wert:

| Wert | Max. Fehler, ohne zusaetzliche f32-Rechenrundung |
| --- | ---: |
| x bzw. z | 2,930 mm |
| y | 0,549 mm |
| Wurzelposition, euklidisch | 4,180 mm |
| Laenge | 0,0306 mm |
| tilt | 0,00002397 rad / 0,001374 Grad |
| Breite | 0,0153 mm |
| yaw, hA, vier Bytes | 0 gegen die bisher hochgeladenen Werte |

**Blattspitzen:** Die Wurzelgrenze allein ist kein Vertexfehlernachweis. Fuer
die Mittellinienspitze (u=0,v=1) kommt vor der Kuestenabbildung grob hinzu:
weniger als 0,12 mm durch tilt, 0,05 mm durch Laenge sowie eine Aenderung des
raeumlichen Stroemungsfelds. Mit Laenge <=3,2 m, wirksamer Hoehe <=48 m und
den unveraenderten Bewegungsparametern liegt eine konservative analytische
Abschaetzung bei **unter 7 mm** fuer diese Spitze vor `coastPosition`.
Dies ist eine Abschaetzung der Formeln, kein formal bewiesener GPU-Fehlerbound.
Float32-Decode/Rundung und die Kuestenabbildung im Daten-/Vertexprobe mitmessen.

An seitlichen Traegerverteces wirken zusaetzlich Kamera-Abstandsblenden auf
die Breite. Dort ist die 7-mm-Aussage nicht uebertragbar: Fehler koennen im
Nah-Ausblendbereich staerker wachsen. Ausserdem koennen wenige Millimeter
an einem nahen Blatt mehrere Bildpixel bewegen. Deshalb nicht allein ueber
mittleren Bildfehler oder ein Weltmillimeter-Limit freigeben.

Provisorische Abbruch-/Untersuchungsgrenzen fuer die Probe: Spitze >1 cm
ausserhalb des Strands oder >2 cm nach der Strandabbildung; unvermutete
Seitenvertexfehler >3 cm; jeder abweichende `pr.x`-/`kq`-Verzweigungswert bei
gleichem Blatt/Zeitpunkt. Diese Grenzen sind Suchalarme, keine Erlaubnis fuer
sichtbare Verschlechterung. Nahe Silhouetten muessen zusaetzlich visuell passen.

### Warum nicht pauschal Float16?

Bei absoluten Koordinaten um 128 m hat binary16 bereits eine Schrittweite
von 0,125 m: bis 6,25 cm Rundungsfehler pro Komponente. Das ist erheblich
groeber als der feste UNORM16-Bereich. Auch Winkel, Hoehe und Laenge erhalten
andere Fehlerverteilungen. `float16x4` spart nicht mehr Bytes als `unorm16x4`;
es ist fuer diese begrenzten Parameter deshalb nicht die erste Wahl.

Die naive 20-B-Variante (alle acht Floats UNORM16) spart mehr, veraendert aber
die beiden oben beschriebenen empfindlichen Funktionen. Sie ist ein anderer
Versuch mit potentiell anderem Erscheinungsbild, keine erhaltende Abkuerzung.

## Rechnerische Kosten

Aus den aktuellen `beach-browser.json`-Arraygroessen, inklusive Fernkopie:

| Stufe | Bisherige Blattpuffer | 24-B-Ziel | Ersparnis | 20-B-Potenzial, derzeit nicht empfohlen |
| --- | ---: | ---: | ---: | ---: |
| High | 102.145.392 B | 68.096.928 B | 34.048.464 B / 32,47 MiB | 43,29 MiB |
| Medium | 53.101.656 B | 35.401.104 B | 17.700.552 B / 16,88 MiB | 22,51 MiB |
| Low | 28.579.788 B | 19.053.192 B | 9.526.596 B / 9,09 MiB | 12,11 MiB |

Das ist die Nutzdaten-/GPU-Pufferrechnung, keine Prozess-RSS-Messung. Die
fertigen CPU-Blattkopien werden bereits nach Upload freigegeben; dauerhaft
kommt diese Summe deshalb nicht nochmals auf CPU-Seite hinzu. Der temporaere
Puffer und das Uploadvolumen werden kleiner, die grossen JS-Generatorlisten
bleiben. Mit gemeinsamem Nah-/Fernspeicher ueberlappt das Potenzial und muss
neu gerechnet werden.

HTML: einige hundert Bytes bis etwa 1 kB Zusatzcode fuer Encode/Decode als
Arbeitsabschaetzung, nicht gemessen. GPU: weniger Bandbreite, mehrere Decode-
Multiplikationen/Additionen pro Vertex; Gesamtlaufzeit kann besser oder schlechter
werden. CPU-Start: sechs Quantisierungen pro Datensatz kosten Arbeit, kleinere
Uploads koennen sie teilweise ausgleichen. Keine Start-/FPS-Garantie.

## Pruefplan vor Uebernahme

1. Isolierte Varianten aus `3178034`: baseline, packed24. Keine gleichzeitige
   Schatten- oder LOD-Datenoptimierung. Build-/Sourcehashes speichern.
2. Vor Freigabe der CPU-Arrays Range-Probe fuer big/bigF/small aller Stufen.
   Gleiche Anzahlen, Zellstart/Bounds, Typ/Seed/Biegungsbytes; yaw/hA nach
   Decode bitgleich. Alle anderen Welt-/Mesh-/Kollisionshashes identisch.
3. GPU-Decode-Probe auf allen Datensaetzen oder stratifiziert allen Extremen:
   Ausgabe der sechs Werte, yaw/hA, `pr.x`, kq/ka und Vertexpositionen; Fehler
   gegen Baseline protokollieren. Insbesondere negative yaw, yaw >2pi,
   Stengeltyp 1, Haengeblaetter, Low-Fernbreiten sowie Zeiten nahe kq=-.06.
4. Fixed views in High/Medium/Low, gleiche Kamera, 1280x720, Detail, Zeit:
   sechs Gesamtansichten, drei Nahdetails, dichte Bodenmatten, Haengeblaetter,
   Kelpstengel, glitzernde Blaetter, Strand oben/unten. Auch 2560x1440 fuer
   wenige kritische Nahbilder, weil Quantisierung bei mehr Pixeln sichtbarer ist.
5. Zeitsequenzen 30/60 Hz mit mindestens 2 s sowie weit getrennte Zeiten
   0/8/30/60/300 s. Bestehende Frequenzen, ka-Verzweigung und Glitzerauswahl
   pruefen; kein neu getaktetes Zucken oder anderes Funkeln akzeptieren.
6. Langsame Kamerawege durch die vorhandenen 24-/58-m-LOD-Grenzen und
   Zellgrenzen; `det` 1 sowie 0,4. Fernbreite bleibt 1,5, bestehende Auswahl
   bleibt gleich. Keine weitere Ausduennung oder verringerte Sichtweite.
7. Schatten bei t=0 und sichtbare Schattenkanten in drei Stufen pruefen;
   auch Schattenfragment-Clip und Typ-1-Sonderfall. Keine neue Schatten-
   Formatvariante in dieselbe Messung mischen.
8. Browserfehler, Offline, Bewegung/Surfacing, Menue, Audio. Pointer Lock wie
   in vorhandenen Runnern unterdruecken, eigenes temporaeres Profil.
9. Getrennter Zeitlauf: warmup plus mindestens drei wechselnde baseline/
   candidate-Runden pro Stufe und feste Kameras. Startzeit, Packzeit, Upload-
   und GPU-Zeit getrennt berichten. Nur danach anhand sichtbarer Ergebnisse
   und gemessener Kosten uebernehmen; ansonsten isoliert verwerfen.

Keine Rohdaten zu neuen Wertebereichen oder Bildnachweise liegen bereits vor.
Die Zahlen oben stammen aus vorhandenen Pufferzaehlungen und Formelanalyse.

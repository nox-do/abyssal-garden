# Plan: Schattenkarte mit 16-Bit-Tiefe

**Go fuer einen isolierten Versuch; noch keine Freigabe zur Produktuebernahme.**
Nur das Format der vorhandenen Schattenkarte und der drei zugehoerigen
Rasterpipelines umstellen. Schattenaufloesung, Weltinhalt, Lichtmatrix,
Schattenfilter und Kameratiefe bleiben gleich. Das ist voraussichtlich der
kleinste Eingriff der untersuchten Speicherideen.

Stand: `3178034`, 18.11.2026. AGENTS.md und optimization-handoff gelesen.
Dieser Agent hat nur den Plan geschrieben, Quellen gelesen, die Primaerspezifikation
geprueft und Varianten im Speicher gebaut. Keine Produktdateien geaendert,
keinen Browser gestartet, keine eingefrorene Referenz angefasst.

## Befund und Einsparung

`source/src/main.js:33` teilt aktuell `DEPTH='depth32float'` zwischen Kamera und
Schatten. `tShadow` entsteht in Zeile 44, `shadowPipe` in Zeile 91. High hat
4096 x 4096 Schattenpixel, Medium/Low 2048 x 2048 (`quality.js:16`). Die Karte
wird einmal beim Start gebacken (`main.js:333`), spaeter bei jedem Bild gelesen.

| Stufe | D32-Nutzdaten | D16-Nutzdaten | Nominelle Ersparnis |
| --- | ---: | ---: | ---: |
| High | 67.108.864 B / 64 MiB | 33.554.432 B / 32 MiB | 33.554.432 B / 32 MiB |
| Medium | 16.777.216 B / 16 MiB | 8.388.608 B / 8 MiB | 8.388.608 B / 8 MiB |
| Low | 16.777.216 B / 16 MiB | 8.388.608 B / 8 MiB | 8.388.608 B / 8 MiB |

Das ist aus Format und Aufloesung berechneter Texturbedarf. Physischer
Treiberspeicher, RSS und Spitzenverbrauch sind damit nicht gemessen. Keine
zusaetzlichen CPU-Arrays, Renderpaesse, Dreiecke oder Shaderarithmetik.

Die WebGPU-Spezifikation fuehrt `depth16unorm` ohne optionales Feature auf;
Render-Attachment und Texture-Binding sind erlaubt. Vergleichssampler duerfen
Tiefentexturen auch mit Filterung lesen. Unser `texture_depth_2d`,
`sampleType:'depth'` und linearer `sampler_comparison` passen deshalb weiter.
Das ersetzt keine konkrete Browser-/Backend-Pruefung.
[Primaerquelle: WebGPU-Tiefenformate](https://gpuweb.github.io/gpuweb/#depth-formats)

## Minimaler Patch

Nur drei Stellen in `source/src/main.js`:

```js
// 1. Eigene Konstante; Kameratiefe ausdruecklich unveraendert.
const Q = device.queue, HDR = 'rgba16float', DEPTH = 'depth32float', SHADOW_DEPTH = 'depth16unorm';

// 2. Nur die eigentliche Schattenkarte.
const tShadow = tex(SHADOW, SHADOW, SHADOW_DEPTH, TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING);

// 3. Nur im Helper shadowPipe, nicht in scenePipe.
depthStencil: { format: SHADOW_DEPTH, depthWriteEnabled: true,
  depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 1.5 }
```

Damit erhalten `pTerrSh`, `pSolidSh` und `pLeafSh` das passende Format.
`depthClearValue:1`, `depthCompare:'less'`, Culling und Blatt-Discard bleiben
erhalten. Der Hauptpass nutzt weiterhin D32 und Reverse-Z (`greater`, Clear 0).

**Dummy nicht umstellen:** `tDummy` ist nur eine gebundene 1x1-Tiefentextur fuer
`bg0s`, kein Attachment. Sie verhindert, dass beim Backen die aktive
Schattenkarte gleichzeitig gelesen wird. Sie darf D32 bleiben, weil die
Binding-Deklaration keinen konkreten Tiefenformattyp verlangt. Sie durch
`tShadow` zu ersetzen waere eine Ressourcen-Nutzungskollision; das ist keine
sinnvolle Einsparung. Ein Formatwechsel der Dummy-Textur spart lediglich
nominell zwei Byte und schafft einen unnoetigen zweiten Allokationsunterschied.

## Wichtig: depthBias ist nicht formatneutral

Bei UNORM wird der konstante Rasterbias in Einheiten des kleinsten positiven
Tiefenwerts angewandt. Bei Float ist der konstante Anteil tiefenabhaengig.
Die Zahl `2` beizubehalten erhaelt also nicht denselben geometrischen Offset.
[Primaerquelle: WebGPU Depth/Stencil State](https://gpuweb.github.io/gpuweb/#depth-stencil-state)

Unsere Lichttiefe reicht von -175 bis +125 m (`main.js:133`), also 300 m:

- Ein D16-Schritt entspricht `300 / 65535 = 0,004578 m` entlang der Lichtachse.
- `depthBias:2` fuegt bei D16 etwa 9,16 mm konstanten Offset hinzu.
- Der vorhandene Receiverbias in `shaders.js:263`, `s.z-.0007`, entspricht
  bereits 0,21 m entlang dieser Achse. Er bleibt im ersten Versuch gleich.
- `depthBiasSlopeScale:1.5` bleibt ebenfalls gleich. Bei steilen Dreiecken
  kann dieser Anteil wesentlich groesser sein; die Rechnung oben beschreibt
  nur den konstanten Anteil.

Deshalb drei getrennte Varianten pruefen:

1. **baseline:** D32, Rasterbias 2, SlopeScale 1.5, Receiverbias .0007.
2. **shadow16-bias2:** Nur Formatwechsel; diagnostische Trennung der Ursachen.
3. **shadow16-bias0:** D16, konstanter Rasterbias 0, sonst gleich. Das entfernt
   den neuen groben konstanten Offset, ohne den Slopebias abzustellen.

**Arbeitsfavorit fuer eine Uebernahme ist Bias 0**, sofern die Gegenbilder keine
zusaetzliche Selbstverschattung zeigen. Bias 2 ist vor allem die diagnostische
Gegenprobe; seine neue konstante Verschiebung ist nicht automatisch gewuenscht.

Nicht behaupten, Bias 0 reproduziere exakt den alten Floatbias. Wenn Bias 0
neue Selbstverschattung zeigt, Bias 1 als begruendete weitere Variante pruefen;
keinen grossen automatischen Parameter-Sweep starten. Receiverbias und Slope
nicht gleichzeitig nach Geschmack veraendern: Das erschwert die Zuordnung.

## Bereits statisch gemessene Dateikosten

In-Memory-Build mit derselben esbuild-Minifizierung wie `source/build.mjs`,
Node v22.23.4; keine Datei geschrieben. Baseline ist bytegleich mit index.html.

| Variante | HTML | gzip Level 9 | Differenz zu Baseline |
| --- | ---: | ---: | --- |
| baseline | 105.121 B | 42.433 B | — |
| shadow16-bias2 | 105.139 B | 42.448 B | +18 B HTML / +15 B gzip |
| shadow16-bias0 | 105.139 B | 42.449 B | +18 B HTML / +16 B gzip |

SHA-256:

- baseline: `f3fd418f1a34f3729f86c460d24f51ccccc8ad635400308e7721e387ecdf1fd6`
- shadow16-bias2: `d44138d4a64436f09425d5a53a4b5320c811b0a753605518cdd1168fcdbd6e27`
- shadow16-bias0: `b0075d5ab5ad5f9d12959c281908e72010eabd7d5d896bebb33cc69a4f860dbc`

Startzeit und laufende GPU-Zeit sind **ungeprueft**. Kleinere Karte kann beim
Backen und Lesen helfen; Shadercompiler, Cache und Treiber koennen das Ergebnis
dominieren. Weil die Karte einmalig gebacken wird, entfaellt kein laufender
Shadow-Renderpass. Anzahl der Schatten-Texture-Samples bleibt gleich.

## Reproduzierbare Pruefung

Eigener Builder/Runner unter `experiments/demoscene/`, Baseline aus Produktstand
3178034. Keine historischen surface/leaves-Berichte ueberschreiben. Normale
HTMLs fuer Groessen, instrumentierte HTMLs fuer QA/Zeitmessung getrennt bauen.

1. **Daten und API:** alle bisherigen 135 Welt-/Mesh-/Kollisions-/Kartenhashes
   muessen je Qualitaet gleich bleiben. Alle GPU-Pufferdeskriptoren identisch;
   genau eine Textur unterscheidet sich ausschliesslich im Format: `tShadow`.
   Pipelineprotokoll: nur die drei Schattenpipelines wechseln Tiefenformat,
   optional den benannten Bias. Keine WebGPU-Validierungs-/JS-Fehler,
   kein Device-Lost und kein automatischer Qualitaets-Fallback.
2. **Bildumfang:** gleiche 1280x720, interne Aufloesung und `det=1`, t=8 s.
   Sechs POSES, Nahbilder 1/4/6 aus dem vorhandenen Runner; Oberwasser Mitte,
   Ost-/Westkueste und vier Strandbilder. Fuer schnelle erste Sichtung reicht
   High mit beiden Kandidaten; die ausgewaehlte Variante danach vollstaendig
   auf High/Medium/Low gegen D32 pruefen.
3. **Gezielte Beurteilung:** Selbstverschattungsflecken auf flachen Felsen,
   abgeloeste Kontaktschatten an Steinen/Schwaemmen, duenne Kelp-/Blattkonturen,
   Wrackstreben, Fels-/Sanduebergang, Lichtstrahlen. High besitzt weitere
   gebackene Objektschatten; Medium/Low brauchen deshalb eigene Vergleiche.
   Low mit shadow1 hat weniger Filterung und kann Quantisierung staerker zeigen.
4. **Zeitlich:** feste Kamera an Pflanzen/Schattenkante, t=8..9 in 1/30-s-
   Schritten; ausserdem langsame seitliche Kamerafahrt bei festem t=8 ueber
   dieselbe Schattenkante. Das trennt Blattbewegung von kamerabedingtem Flimmern.
   Jeden Frame mit identischen Posen/Zeiten zwischen Varianten vergleichen.
   Die Schattenkarte selbst bleibt absichtlich zeitlich statisch wie bisher.
5. **Auswertung:** absolute Pixelunterschiede, geaenderte Pixel, MAE und starke
   Differenzen erfassen; Nahbilder und Differenzkarten visuell pruefen. Ein
   kleiner globaler MAE kann lokale schwarze Flecken verbergen. Keine reine
   Pixelgleichheitsforderung fuer ein anderes Tiefenformat und keine neue
   pauschale Toleranz allein aus dem ersten Ergebnis ableiten.
6. **Falls der finale Farbvergleich Ursachen verdeckt:** optional im QA-Build
   eine monochrome Schatten-Sicht fuer dieselben Oberflaechen ausgeben. Die
   Produktionsshader dafuer nicht veraendern. Direktes Tiefen-Readback nur
   diagnostisch und getrennt von Laufzeit-/Speichermessungen einsetzen.
7. **Bedienung/Offline:** eigene temporaere Chrome-Profile, Netzwerk deaktiviert,
   requestPointerLock unterdrueckt, Audio/Start/Menue/Stufenwechsel pruefen.
   Kurzer Auf-/Abtauch- und Uferlauf genuegt hier, da Physikcode und Datenhashes
   unveraendert sind; keine erneute 90-Wege-Suite ohne neue Abweichung noetig.
8. **Zeitmessung nach bestandener Qualitaetspruefung:** Baseline gegen den
   besten D16-Kandidaten, 1 Warmup + mindestens 3 Messseiten je Stufe, Reihenfolge
   alternieren. Separate Start-/Shadow-Bake-Marke und 4 feste GPU-Benchansichten.
   Keine parallelen Browser-/GPU-Agenten. Mediane und Bereiche berichten;
   CPU-Nutzdaten, nominelle Texturkosten und Prozessspeicher getrennt halten.

## Entscheidung und Rueckweg

Uebernahme nur, wenn die Speicheranforderung wie erwartet sinkt, alle drei
Stufen funktionieren und in den festgelegten Detail-/Zeitvergleichen keine
sichtbare Schattenverschlechterung entsteht. Eine eindeutig sichtbare
Regression beendet diesen kleinen Versuch; nicht mit weniger Vegetation,
kleinerem Bild oder dunklerem Licht kompensieren. Ein konsistenter GPU-/Start-
Nachteil muss gegen den Speichergewinn abgewogen und benannt werden.

Bei Erfolg die drei main.js-Stellen in source uebernehmen, normal bauen und
Shipping-Offline-Test ausfuehren. Bei Ablehnung Produktstand 3178034 beibehalten
und nur getrennte Ergebnisse dokumentieren. Ein `shadow16-only.patch` kann
die kleine Quellaenderung isoliert ruecknehmbar machen. Ein zweiter D32-Puffer
als dauerhafter Fallback wuerde den Speichergewinn aufheben und gehoert nicht
in diesen Versuch.

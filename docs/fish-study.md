# Kleine bunte Fischgruppen im flacheren Wasser

Versuch auf Nutzerauftrag, Basis `cc3d14b` (105.306 B HTML). Produktquellen in
`source/`; eingefrorener Upstream unveraendert. Mit der anschliessenden Rundung
auf Nutzerwunsch lokal committed; nichts gepusht.

**Historische erste Fischversion.** Nach Feedback zu den kantigen Koerpern
folgt ein isolierter Rundungsversuch: [`fish-shape-study.md`](fish-shape-study.md).
Aktuelles HTML 107.000 B; die folgenden Messungen gelten fuer die erste,
106.554 B grosse Version. Deren Builder rekonstruiert jetzt den gespeicherten
Patch, damit diese Referenz trotz spaeterer Produktaenderungen reproduzierbar ist.

## Ausgangspunkt und Gestaltung

Die bisherigen 4.240 Fische gehoeren zu zwoelf grossen Schwaermen, deren
Zentren 22–36 m tief liegen. `world.js`, `SCH`, bestimmt diese Positionen.
`shaders.js`, `fsFish`, verwendet Graublau mit gelegentlicher goldener
Beimischung und starken silbrigen Reflexen. Diese Kombination vermittelt
einen entfernten Schwarm gut, bietet aber wenig auffaellige Farbe in der
oberen Wasserschicht.

Als Vorbilder dienen [Paletten-Doktorfische](https://www.georgiaaquarium.org/animal/palette-surgeonfish/)
mit blauen/schwarzen Flaechen und gelbem Schwanz sowie
[gelbe Segelflossendoktoren](https://www.aquariumofpacific.org/onlinelearningcenter/species/yellow_tang).
Es sind stilisierte Farb-/Formvarianten, keine anatomisch exakten Artmodelle.
Wasser filtert die Farben weiter wie zuvor; keine Emission oder zusaetzliche
Beleuchtung fuer die Fische. Hintergrund:
[NOAA zur Farbabsorption im Wasser](https://oceanexplorer.noaa.gov/ocean-fact/red-color/).

Ergaenzt werden **56 Fische in sieben Gruppen zu acht Tieren**. Zentren und
Bahnradius in Metern:

| Bereich | Zentrum x/y/z | Radius | Farbtyp |
| --- | --- | ---: | --- |
| Hauptschlucht | 0 / -7 / -10 | 5 | Blau mit gelbem Schwanz |
| Kelpbecken West | -8 / -5 / -76 | 5 | Blau mit gelbem Schwanz |
| Kelpbecken Ost | 9 / -7 / -69 | 4 | Gelb |
| Beim Wrack | 50 / -6 / 10 | 4 | Blau mit gelbem Schwanz |
| Schwammwald | -58 / -5 / 8 | 4,5 | Gelb |
| Grotte | 7 / -4 / 76 | 4 | Blau mit gelbem Schwanz |
| Vor der Sandbucht | -150 / -3,8 / 10 | 3 | Gelb |

Die erste Grottenroute lag mit ihrem geprueften Bewegungsraum zu nahe am
Felsen; ihr Zentrum wurde von -6 auf -4 m gehoben. Kleine, langsamere Bahnen
mit geringerer vertikaler Bewegung halten die neuen Fische unter Wasser.
Sie verteilen sich ueber die Bahn und haben individuelle Groessen/Phasen.

## Umsetzung und sichtbarer Nutzen

Nur `source/src/world.js` und `shaders.js` aendern sich. Die neuen Instanzen
werden an den vorhandenen Fischpuffer angehaengt. `ihash` erzeugt ihre Seeds,
ohne die bestehende Zufallsfolge fuer Fische oder Schwebeteilchen fortzuschalten.
Ein negatives Phasenfeld speichert Farbtyp und Bahnphase im bestehenden
32-Byte-Datensatz. Fuer alte Instanzen bleiben Eingaben und Bewegungsparameter
erhalten.

Das vorhandene Fischmodell wird fuer die neuen Tiere hoeher und schmaler
skaliert; die Normalen erhalten die passende inverse Skalierung. Farbmaske,
gelber Schwanz, Auge und dezente Kiemenlinie verwenden die bereits vorhandenen
lokalen Koordinaten. Die Zeichnung bewegt sich dadurch mit dem Fisch.
Fuer diese Fische sind die silbrigen Glanz-/Randreflexe abgeschwaecht, damit
sie ihre Farbe bei wechselndem Blickwinkel besser behalten.

**Visuelle Einschaetzung:** In den Nahansichten sind blaue Koerper, dunkle
Zeichnung, gelbe Schwaenze und die gelbe Variante klar erkennbar. Die Gruppen
beleben die obere Wasserschicht und sind beim Auftauchen erreichbar. Aus
groesserer Entfernung werden Farben weiterhin durch das Wasser abgeschwaecht.
Sehr nah bleibt die einfache, kantige Silhouette des bisherigen Schwarmmodells
sichtbar; der Versuch loest keine vollstaendige Fischmodellierung. Es werden
keine weiteren Modell-/Texturdetails als Teil dieses Versuchs hinzugefuegt.

## Nachweise

Reproduktion: [`experiments/fish/RUN.txt`](../experiments/fish/RUN.txt).
Separate normale, QA- und Timing-Builds. Chrome 157 / Apple Metal, 1280x720,
Detailfaktor 1, alle drei Qualitaetsstufen. Eigenes Headless-Profil, Netzwerk
deaktiviert, Pointer Lock unterdrueckt; keine Uebernahme der physischen Maus.

- **258 kontrollierte Bilder**, 43 je Variante/Stufe: sechs vorhandene
  Kamerapositionen, sechs Gruppenansichten, Gesamt-/Oberflaechenansicht,
  zwei Nahansichten, jeweils zwoelf aufeinanderfolgende 30-Hz-Phasen in den
  Nahansichten und drei spaetere Zeitpunkte. Vorher/nachher gleiche Kamera,
  Zeit, Aufloesung und Detailstufe. Keine auffaelligen neuen Spruenge in den
  geprueften Zeitfolgen erkannt; keine allgemeine Flimmergarantie.
- 132 von 133 Welt-/Mesh-/Kollisionshashes unveraendert. Ausschliesslich
  `Wd.fish` waechst. Alle 4.240 alten Fischdatensaetze stimmen exakt als
  Pufferpraefix ueberein; Pflanzen, Partikel, Terrain, Mantas und Modelle
  behalten ihre Daten. Der groesste alte Seed ist <1, sodass die neue
  Materialkennung nicht mit einem alten Fisch kollidiert.
- Gleiche Ressourcen-/Pipeline-Deskriptoren bis auf +1.792 B im Fischpuffer.
  Keine neuen Puffer, Texturen, Vertexlayouts, Pipelines oder Draw-Aufrufe.
- 13.440 Abfragen pruefen einen erweiterten Bewegungsraum um die sieben
  Bahnen gegen das Kollisionsfeld, kleinster gelieferter Abstand 0,522 m.
- Zusaetzlich berechnet ein **ausschliesslich im QA-Build enthaltener**
  Compute-Shader dieselbe Vertexfunktion auf der GPU. So stimmen auch die
  floatbasierten Zufallshashes; eine CPU-Sinus-Nachbildung waere dafuer
  unzuverlaessig. 56 Fische an 361 Zeitpunkten von 0 bis 180 s, je Mittelpunkt
  plus sechs um 0,4 m versetzte Pruefpunkte: 141.512 Kollisionsabfragen.
  Kleinster Feldabstand 0,961 m. Hoechster Mittelpunkt einschliesslich
  0,4-m-Reserve: -2,719 m. Es handelt sich um Stichproben gegen das Terrain,
  keinen kontinuierlichen Beweis oder eine Kollisionserkennung mit Pflanzen
  und allen separaten Dekorationsobjekten.
- Vorwaertsbewegung und Kamerazustand stimmen zur Baseline ueberein.
  Menue, Mute/Unmute, laufender Audiokontext und Offline-Betrieb bestanden.
  Keine JavaScript-/GPU-Fehler oder Qualitaets-Fallbacks in den finalen Faellen.

Die Nahkameras in `poses.json` wurden aus den GPU-Positionen bei t=8 s
abgeleitet und danach fuer beide Varianten fixiert. Baseline-Bilder zeigen
an diesen Positionen denselben Hintergrund ohne die neuen Tiere. Bilder
und Differenzmetriken dokumentieren die Aenderung; der mittlere Pixelabstand
ist kein Qualitaetsmass.

## Footprint

| Kosten | Baseline → Versuch | Differenz |
| --- | ---: | ---: |
| HTML | 105.306 → 106.554 B | **+1.248 B** |
| gzip Level 9 | 42.537 → 43.023 B | **+486 B** |
| GPU-Fischpuffer, alle Stufen | 135.680 → 137.472 B | **+1.792 B / 1,75 KiB** |
| Modellpuffer / Texturen / Draw-Aufrufe | unveraendert | 0 |
| Gerenderte Fischdreiecke pro Bild | 212.000 → 214.800 | +2.800 |

56 zusaetzliche Instanzen des vorhandenen Modells bedeuten trotz unveraenderter
Modellpuffer zusaetzliche Vertex-/Rasterarbeit. Die temporaere CPU-Float32-
Vorlage waechst ebenfalls um 1.792 B und wird nach dem Upload freigegeben.
JS-Zwischenlisten/Objekt-Overhead und realer Prozess-/Spitzenspeicher wurden
nicht gemessen. Der GPU-Pruefhelfer und dessen Puffer sind nicht im Produkt
oder in der Zeitmessung enthalten.

Separate Render-/Startzeitmessung: eine Aufwaermrunde, drei Messrunden je
Stufe/Variante, wechselnde Reihenfolge. Zwei Ansichten (vorhandene Pose 1,
neue blaue Nahansicht), jeweils 20 Aufwaermbilder und 60 Samples. GPU-
Zeitstempel fuer serialisierte Renderpaesse, keine Gameplay-FPS-Messung;
wiederholte lokale Seiten, kein kalter System-/Browserstart.

| Qualitaet | Startmenue, Median vorher → nachher | GPU Pose 1 vorher → nachher | GPU Nahansicht vorher → nachher |
| --- | ---: | ---: | ---: |
| High | 2.464,0 → 2.446,8 ms | 11,338 → 11,272 ms | 11,043 → 11,305 ms |
| Medium | 2.343,4 → 2.374,5 ms | 9,011 → 9,110 ms | 8,716 → 8,651 ms |
| Low | 2.298,6 → 2.301,5 ms | 3,539 → 3,539 ms | 3,080 → 3,015 ms |

Die groesste positive GPU-Mediandifferenz liegt in der High-Nahansicht bei
**+0,262 ms**, mit ueberlappenden Seitenmedian-Bereichen (Baseline 10,977–11,469;
Versuch 10,813–11,469 ms). Keine konsistente Beschleunigung oder grosse
Regression ueber die Stufen. CPU-Encoding-Mittelwerte pro Seite unterscheiden
sich im Median um -0,040 bis +0,030 ms; die Bereiche streuen deutlich. Der
Start liegt auf Medium +31,1 ms, auf Low +2,9 ms und auf High -17,2 ms. Aus
diesen drei Messseiten je Gruppe keinen allgemeinen Startzeitgewinn ableiten.
Rohwerte, Mediane und Bereiche stehen in `timing.json` und `summary.json`.

## Uebernahme und Rueckweg

Als kleiner visueller Versuch in den Produktquellen und im normalen
`index.html` uebernommen: erkennbare neue Farbakzente in der oberen
Wasserschicht bei +1,2 kB HTML und +1,75 KiB GPU-Puffer. Der normale Build
war bytegleich zu `variants/shallow.html`. Abschliessender Offline-
Start mit Audio/Menue/Bewegung auf drei Stufen: `results/shipping.json`.

`experiments/fish/fish-only.patch` nimmt ausschliesslich diese beiden
Quellaenderungen zurueck; eine spaetere Rundung vorher mit ihrem eigenen
`experiments/fish-shape/shape-only.patch` umkehren, danach normal bauen.
Der vorherige Stand mit den
GPU-Speicheroptimierungen bleibt dabei erhalten. Zusammen mit der Rundung
auf Nutzerwunsch lokal gesichert; nichts gepusht.

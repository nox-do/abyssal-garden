# Rundere Formen fuer die flachen Fischgruppen

Fortsetzung nach Nutzerfeedback zur kantigen ersten Fischversion. Die direkte
Baseline ist **der bereits bunte Fischversuch mit 106.554 B HTML**, nicht die
Welt ohne diese Fische. Beide Schritte sind auf Nutzerwunsch lokal committed;
`cc3d14b` ist die Referenz vor den Fischen. Nichts gepusht.
Reproduktion: `experiments/fish-shape/RUN.txt`.

## Ursache und kleiner Eingriff

`source/src/world.js`, `meshFish`, verwendet bisher fuenf Querschnitte mit
sechs Punkten. In der Seitenansicht bleiben lange gerade Strecken und wenige
deutliche Ecken an Kopf, Ruecken und Bauch. Die hoehere Skalierung in
`shaders.js`, `vsFish`, macht das bei den neuen, nah erreichbaren Tieren
besonders auffaellig. Farben oder Antialiasing koennen diese Silhouette nicht
runden. Ausserdem zeigen die Flaechennormalen des bisherigen Koerpers nach
innen: Die Beleuchtung beschreibt dadurch die falsche Seite der Oberflaeche.

Der Versuch gibt **nur den 56 flachen Fischen** ein eigenes, kleines Modell:

- Analytisches, gerundetes Laengsprofil statt linearer Strecken zwischen den
  alten Eckpunkten. 13 Querschnitte, um Schnauze und Schwanzwurzel dichter
  verteilt, mit acht Punkten je Querschnitt. Schnauze und hinteres Ende sind
  geschlossen. Der spitze Schwanz bleibt eine einfache Flosse.
- Korrekte Orientierung der Dreiecke ergibt nach aussen gerichtete, geglaettete
  Normalen. Keine neue Beleuchtung, Textur oder Shaderfunktion.
- `main.js` haengt das Modell an die bestehenden gemeinsamen Modellpuffer an.
  Zwei Aufrufe derselben Fischpipeline zeichnen erst die 4.240 bisherigen
  Fische, dann die 56 neuen. `nSchoolFish` speichert die Trennstelle aus der
  Weltgenerierung, ohne eine feste Anzahl in den Renderer einzubauen.

Die bisherigen Schwarmmodelle bleiben bytegleich, einschliesslich ihrer
historischen Normalen. Ein globaler Umbau wuerde deren Erscheinungsbild
aendern und die zusaetzlichen Dreiecke auf tausende Fische vervielfachen.
Farbmasken, Groessen, Bahnen, Schwanzbewegung und Instanzdaten bleiben gleich.

**Visuelle Einschaetzung:** Der flache, fast sechseckige Umriss wird zu einem
deutlich gerundeten Koerper. Der helle Ruecken und dunklere Bauch machen das
Volumen besser lesbar; in schraegen und gegenueberliegenden Ansichten bleibt
die Form geschlossen. Die Nahansichten rechtfertigen hier den kleinen,
gezielten Geometriezuwachs. Aus groesserer Entfernung ist der Nutzen kleiner.
Die Fische bleiben stilisiert: flache, spitze Schwanzflosse, einfache Zeichnung
und keine anatomisch ausgearbeiteten Brust-/Rueckenflossen.

## Gemessener und berechneter Footprint

| Position | Kantig → gerundet | Zusatz |
| --- | ---: | ---: |
| HTML | 106.554 → 107.000 B | **446 B** |
| gzip Level 9 | 43.023 → 43.241 B | **218 B** |
| GPU-Modellpuffer, alle Stufen | bestehende Puffer wachsen | **3.020 B / 2,95 KiB** |
| Neue Texturen / Pufferobjekte / Pipelines | 0 / 0 / 0 | 0 |
| Fisch-Zeichenaufrufe pro Bild | 1 → 2 | 1 |
| Dreiecke eines neuen Fisches | 50 → 210 | 160 |
| Fischdreiecke pro Bild insgesamt | 214.800 → 223.760 | 8.960 |

HTML und Bufferdeskriptoren sind gemessen; Dreiecksarbeit folgt aus den
geprueften Draw-Argumenten. Der neue Mesh hat 110 Vertices: 1.760 B Vertexdaten
und 1.260 B hochgeladene Uint16-Indizes. Seine temporaeren Typed Arrays brauchen
4.280 B, weil `Mesh.build()` zunaechst Uint32-Indizes liefert. Beim Zusammenfuegen
wachsen die gemeinsamen CPU-Uploadarrays um weitere 3.020 B; die Vorlagen werden
anschliessend wie bisher freigegeben. JS-Listen, Objekt-/Treiber-Overhead und
Prozess-/Spitzenspeicher sind nicht gemessen. Keine neue Animationsschleife auf
der CPU; pro Bild kommen ein Draw und die zusaetzliche GPU-Geometriearbeit hinzu.

Gegenueber `cc3d14b` kosten **bunte Fische einschliesslich Rundung** insgesamt
1.694 B HTML, 704 B gzip und 4.812 B nominale GPU-Pufferdaten. Endstand:
107.000 B HTML, 43.241 B gzip. Die historische erste Fischmessung bleibt separat.

Separate Zeitmessung: eine Aufwaermrunde, drei Messrunden je Version/Stufe,
wechselnde Reihenfolge, zwei Ansichten mit je 20 Aufwaerm- und 60 Messbildern.
GPU-Zeitstempel fuer serialisierte Renderpaesse; lokale wiederholte Seitenstarts,
keine Gameplay-FPS und kein kalter Systemstart. Mediane der Seitenmessungen:

| Stufe | Startmenue vorher → nachher | GPU Pose 1 vorher → nachher | GPU blaue Nahansicht vorher → nachher |
| --- | ---: | ---: | ---: |
| High | 2.441,1 → 2.427,3 ms | 11,338 → 11,305 ms | 10,879 → 10,945 ms |
| Medium | 2.387,3 → 2.358,9 ms | 8,913 → 8,913 ms | 8,651 → 8,651 ms |
| Low | 2.275,5 → 2.279,7 ms | 3,539 → 3,539 ms | 3,015 → 3,015 ms |

Die High-Nahansicht liegt +0,066 ms, mit ueberlappenden Bereichen der
Seitenmediane (10,813–11,010 vs. 10,879–11,010 ms). Andere GPU-Mediane sind
gleich oder geringfuegig niedriger. CPU-Encoding-Mittelwerte pro Seite
unterscheiden sich im Median um -0,033 bis +0,012 ms, ebenfalls mit
ueberlappenden Bereichen. Kein belastbarer allgemeiner Geschwindigkeitsgewinn
und kein Nachweis kostenloser Zusatzgeometrie. Die kleine Stichprobe zeigt
hier keine auffaellige Laufzeitregression. Rohwerte und Bereiche:
`results/timing.json` und `results/summary.json`.

## Vergleich und Grenzen

- 282 Bilder: 47 je Version und Qualitaetsstufe, Chrome 157 / Apple Metal,
  1280x720, Detailfaktor 1. Gleiche Kameras und Animationszeitpunkte; Gesamt-,
  Gruppen-, Nah-, Schraeg-, Frontal- und Gegenseitenansichten. Zwei Nahkameras
  zusaetzlich in zwoelf aufeinanderfolgenden 30-Hz-Phasen, spaetere Gesamtbilder
  bei 20, 40 und 80 s. Keine auffaelligen neuen Spruenge in diesen Folgen;
  kein Beweis fuer alle moeglichen Blickwinkel oder Zeitpunkte.
- Alle 133 bisherigen Welt-/Mesh-/Kollisionshashes identisch; ausschliesslich
  zwei neue Hashes fuer Modell 26. Alle 4.296 Fischdatensaetze bytegleich.
  GPU-Proben liefern identische Mittelpunkte/Orientierungen. Die analytische
  Obergrenze des deformierten Modellradius betraegt 0,386 m und bleibt unter
  der bisherigen 0,4-m-Reserve der Bahnprobe.
- Separater Geometrietest: altes Modell bytegleich, neue Dreiecke nicht
  degeneriert, endliche Positionen, normalisierte und nach aussen gerichtete
  Koerpernormalen, Indizes innerhalb des Modells.
- Deskriptoren aller Ressourcen identisch bis auf die exakt erwarteten beiden
  Puffervergroesserungen. Die tatsaechlichen Fisch-Draws verwenden 4.240 alte
  und 56 neue Instanzen; die zweite Gruppe beginnt bei Instanz 4.240.
- Kamera-/Vorwaertsbewegung, Menue, Mute/Unmute, laufender Audiokontext und
  Offline-Betrieb bestanden. Testbrowser im eigenen Headless-Profil, Pointer
  Lock unterdrueckt. Keine neue Mausuebernahme.

Bilddifferenzen zeigen die geaenderten Fische und ihre Nachbearbeitung, nicht
automatisch eine Qualitaetsverbesserung. Die Annahme stuetzt sich auf den
sichtbaren Vorher-nachher-Vergleich. PNGs liegen ignoriert unter
`experiments/fish-shape/results/`, insbesondere `before-after.png`.

## Uebernahme und Rueckweg

Die gerundete Form ist wegen des klar sichtbaren Nahbereichsnutzens in den
Produktquellen und `index.html` uebernommen und auf Nutzerwunsch lokal
committed; nichts gepusht.
`shape-only.patch` nimmt nur diese Rundung zurueck und erhaelt die bunten
Fische. Fuer die gesamte Fisch-Ergaenzung danach auch den historischen
`experiments/fish/fish-only.patch` umkehren. Anschliessend normal bauen.
Der eingefrorene Upstream bleibt unveraendert.

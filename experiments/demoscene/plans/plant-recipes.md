# Plan: Pflanzen als kompakter Bauplan

**Go fuer eine kleine Daten-/Cache-Probe; noch kein Go fuer einen Umbau aller
Pflanzen auf GPU-Rekonstruktion.** Zuerst nur die aufrechten Bodencluster vom
Typ 2 untersuchen. Nah-/Fern-Datenteilung und einfaches Parameterpacking haben
weniger Abhaengigkeiten und sollten vorher bewertet werden.

Stand: `3178034`, 18.11.2026. AGENTS.md und optimization-handoff gelesen.
Nur Quellcode und bestehende Ergebnisse untersucht; keine Produktaenderung,
kein Browserlauf, keine gemessene Einsparung dieses Ansatzes. Der eingefrorene
Upstream bleibt unangetastet.

## Was der bestehende Bauplan bereits beschreibt

- `world.js:135`, `column()`: Wurzel, Hoehe, Art und Dichte erzeugen wenige
  Stengel und viele Blaetter; gemeinsame Phasen, Drehung, Radius und Neigung
  werden heute anschliessend in Einzelblattdatensaetze aufgeloest.
- `world.js:192`, `cluster()`: ein Bodenpunkt und feste Klassenparameter
  erzeugen 8-21 Typ-2-Blaetter. Dies ist die kleinste ausreichend einfache
  Pflanzenfamilie: keine eigenen Glints, kein `kelpAbs`-Eintrag, keine
  variablen Zufallszweige innerhalb der Blattgenerierung.
- `world.js:94`, `leaf()`: 12 JS-Zahlen pro erzeugtem, ausgewaehltem Blatt;
  `pack()` ab Zeile 327 macht daraus 36 Byte pro Blatt, zellweise sortiert.
- `shaders.js:450`, `W_LEAF`: Form, Farbe und die vom Nutzer akzeptierte
  Bewegung entstehen schon im Shader. Ein Rezeptdecoder sollte dieselben
  Eingabefelder liefern und danach genau diesen bestehenden Pfad verwenden.

Alle drei Qualitaetsstufen, die vorhandenen Arten und die freie Erkundbarkeit
bleiben erhalten. Der Versuch erfindet keine weniger dicht bewachsene Welt.

## Drei Abhaengigkeiten, die ein einzelner Seed nicht loest

**Zufallsfolge.** `math.js:6` verwendet einen 32-Bit-Zustand mit additivem
Zustandsschritt und anschliessendem Integer-Mixer. `rseed()` trennt Systeme,
aber innerhalb eines Systems haengen die naechsten Pflanzen von der Anzahl
vorher verbrauchter Zufallswerte ab. Beim Typ-2-Cluster werden pro Blatt exakt
acht Werte gelesen: Winkel, Radius, Laenge, Neigung, Breite, s1, s2, Biegung.
Der Eintrittszustand vor dem ersten Blatt reicht fuer eine lokale Wiederholung.
Die fuer die Clusteranzahl zuvor verbrauchte Zufallszahl gehoert nicht dazu.

**Qualitaetsauswahl.** `nth` wird in `makeWorld()` nur einmal initialisiert.
`leaf()` fuer Nicht-Stengel, `glint()` und spaeter Kiesel verwenden denselben
Zaehler; `rseed()` setzt ihn nicht zurueck. Daher `nthBefore` pro Rezept
festhalten und die alte Auswahl `(nthBefore+j) % THIN === 0` verwenden.
Ein lokaler Zaehler ab null wuerde Medium/Low und nachfolgende Inhalte aendern.
Typ-1-Stengel erhoehen `nth` wegen Kurzschlussauswertung gar nicht.

**Zell- und Fernreihenfolge.** Die Blaetter eines Clusters koennen durch den
0,5-m-Wurzelversatz auf mehrere 24-m-Zellen verteilt sein. Die Fernfassung
waehlt jedes zweite Blatt aus der gesamten, bereits qualitaetsgefilterten
Zellliste, nicht jedes zweite Blatt pro Pflanze. Nach dem Entfernen der
Rezeptblaetter duerfen die verbleibenden Pflanzen nicht neu mit anderer
Paritaet ausgeduennt werden. Alte Zellordinalzahl/Fernmitgliedschaft erfassen
und die Reihenfolge aller verbleibenden Datensaetze erhalten.

## Kleinster exakter Versuch: CPU-Rezept fuer Typ-2-Cluster

Nur den Zweig `world.js:206` behandeln, also Klassenkonstanten:
Laenge 1-3 m, Breite .13-.26 m, Maximalneigung .6, hA=2.5, Typ 2.
Die Wurzelwerte stammen aus `T.wp`, also bereits aus Float32. Ein kompakter
32-Byte-Rezeptdatensatz kann deren Eingabewerte ohne weitere Rundung halten:

| Offset | Inhalt | Format |
| --- | --- | --- |
| 0, 4, 8 | x, y, z vor den Cluster-Versaetzen | 3 x Float32 |
| 12 | urspruengliche Blattzahl n | Uint32 |
| 16 | RNG-Zustand am Eintritt | Uint32, identisches Bitmuster |
| 20 | nthBefore | Uint32 |
| 24 | stabile Pflanzen-ID | Uint32 |
| 28 | Rezeptversion / reserviert | Uint32 |

Pflanzen-ID beispielsweise Generator-ID 3 plus der urspruengliche Schleifenindex
0..39999. Blatt-ID ist `(Pflanzen-ID, j)`. Keine Kamera-, Zeit-, Upload- oder
Cache-Slot-Nummer in den Seed aufnehmen. Ein Slot ist nur der momentane
Speicherort und niemals die Identitaet einer Pflanze.

Der lokale Decoder benutzt dieselben JS-Double-Operationen und dieselbe
Auswertungsreihenfolge wie `cluster()`, ohne `_seed` oder `nth` des laufenden
Programms zu veraendern. Danach exakt dieselbe Float32-/Uint8-Konvertierung
wie `pack()`. Das ist ein bytegenau pruefbarer Weg. Die GPU-Rekonstruktion ist
davon strikt getrennt und darf nicht ohne Nachweis als bytegleich gelten.

### Stufe A: reine Reproduktionsprobe, noch kein Speichergewinn

1. Im Experimental-Build beim Eintritt in diesen Clusterzweig das Rezept
   aufnehmen. Die Originalgenerierung laeuft zunaechst unveraendert weiter.
2. Pro Blatt Klassen-ID und urspruenglichen Zellordinal ergaenzen. Nach dem
   originalen Packing die referenzierten 36-Byte-Datensaetze sichern.
3. Rezepte in anderer Reihenfolge, mehrfach sowie nach einem simulierten
   Verwerfen lokal neu aufloesen. Ausgabe inkl. f32-Fernbreite und Farbbytes
   gegen die Referenz vergleichen. N, F, Zellen, Bounds und alle Nicht-Ziel-
   Daten muessen unveraendert bleiben.
4. Globale RNG-/nth-Zustaende vor/nach jedem Cluster und am Ende des Systems
   vergleichen. Erst dann darf die Erzeugung ohne gespeicherte Einzelblaetter
   weitergedacht werden. Ein moeglicher RNG-Sprung um `8*n` additive Schritte
   spart spaeter Mixerarbeit; er ist ein eigener nachzuweisender Umbau.

Die Probe ermittelt auch die tatsaechliche Anzahl M der Typ-2-Cluster, N der
gehaltenen Zielblaetter und F ihrer Fernmitglieder. Die vorhandenen Hashberichte
enthalten nur Gesamtpuffer, daher ist deren Anteil bisher nicht gemessen.
Nicht die kompletten 97 MiB Blattdaten als Potenzial dieser Klasse ausgeben.

### Stufe B: begrenzter Zellcache mit bytegleichen Datensaetzen

Die Zielblaetter werden aus den dauerhaften normalen Blattpuffern entfernt.
Kompakte Zelllisten verweisen auf Pflanzen-ID/Blatt-ID; alte Fernmitgliedschaft
und Culling-Grenzen werden beibehalten. Andere Pflanzen behalten ihre alte
Reihenfolge und Fernauswahl. Der CPU-Decoder erzeugt nur Cache-Eintraege und
laedt die bekannten 36-Byte-Datensaetze hoch. Der normale W_LEAF bleibt gleich.

Cache-Schluessel: Zell-ID, Qualitaetsstufe und Rezeptversion. Vorladen muss alle
potenziell sichtbaren Zellen der bisherigen 150-m-Reichweite plus Bewegungs-
und Blattmargin abdecken, nicht nur den aktuellen Blickkegel. Rasches Drehen,
26-m/s-Bewegung und Kameraspruenge per 1-6 duerfen keine kahlen Zwischenbilder
erzeugen. Ein fester GPU-Pool verhindert staendige Buffer-Allokationen; dessen
gesamte Groesse zaehlt zum Bedarf, auch bei gerade wenigen sichtbaren Zellen.

Zusatzaufwand: Zell-Upload/Verwaltung und meist mehr Draw-Aufrufe. Auf diesem
relativ kleinen, frei erkundbaren Gebiet kann der Cache einen grossen Teil der
Welt gleichzeitig halten muessen. Dann ist der Vorteil gegen Packing klein.
Das muss aus Sichtmengen/Cache-Belegung gemessen werden, nicht aus der Zahl
gerade sichtbarer Pixel geschaetzt.

## GPU-Rekonstruktion: eigener zweiter Versuch

Die 32-Byte-Rezepte und zellweise 32-Bit-Blattverweise koennen als Storage-
Buffer gelesen werden. Ein Verweis kann Pflanzenindex und lokalen Blattindex
enthalten; N und Indexbreite vorher absichern. `instance_index` liefert den
Zugriff fuer den Draw, ist aber nicht selbst der stabile Zufallsseed.
[WGSL instance_index](https://gpuweb.github.io/gpuweb/wgsl/#instance-index-builtin-value)

Der additive RNG erlaubt fuer diese feste Klasse eine direkte Adressierung
des j-ten Blattes: Zustand vor dessen erster Ziehung = Eintrittszustand plus
`8*j` Schritte modulo 2^32. Der Integer-Mixer muss bitgenau portiert werden.
Dies loest nicht die numerische Gleichheit der daraus berechneten Form:

- JS rechnet mit Double und rundet erst beim Packing. WGSL-F32 sowie GPU-sin/
  cos koennen schon vorher abweichen. Reassoziierung/FMA ebenfalls pruefen.
- Die Farb-/Seedbytes im Original entstehen durch Uint8-Konvertierung der
  JS-Werte; Shader-Packing nicht ungeprueft als gleiche Rundung voraussetzen.
- `yaw` fliesst in `shaders.js:496` in einen sin/fract-Hash fuer Glitzer ein.
  Ein kleiner Winkelfehler kann eine diskrete andere Glitzerzuordnung ergeben.
  Ein geometrisch winziger Fehler ist hier kein ausreichendes Abnahmekriterium.

Eine kontrollierte Zwischenstufe koennte deshalb pro Zielblatt den exakten
Float32-yaw und die vier originalen Farb-/Seed-/Biegungsbytes behalten (8 Byte),
nur die uebrigen Formwerte aus dem Rezept ableiten. Das reduziert das Potenzial,
vermeidet aber die offensichtlichste empfindliche Materialaenderung.

Direktes Rekonstruieren im Vertexshader wiederholt acht RNG-Mixes und die
Wuchsform fuer jeden der 18/10/6 Vertices. Zuerst auf dieser einen Klasse messen.
Bei hohem Aufwand ist ein Compute-Decoder pro Cache-Eintritt sinnvoller: einmal
pro Blatt in einen Storage|Vertex-Puffer schreiben, danach normal rendern.
Der ausgepackte Cache belegt weiterhin Speicher. Keine behauptete Ersparnis
durch bloessen Verschieben derselben Daten von CPU zu GPU.

## Licht, Schatten und Bewegung

Typ-2-Bodencluster erzeugen kein `kelpAbs`. `volD` muss daher im ersten Versuch
bytegleich bleiben. Eine spaetere Kelp-Version muss `column()`s gesamten
Absorptionsbeitrag ab `world.js:149` unabhaengig von Cache-Residenz erhalten.
Sonst wird auch ausserhalb des sichtbaren Ausschnitts die Beleuchtung anders.

Der Schattenbake in `main.js:347` zeichnet aktuell alle grossen Blaetter einmal
bei t=0. Auch bei einem Cache muessen alle Rezeptblaetter der Welt in diesem
Bake vorkommen. Sie koennen zellweise in einen wiederverwendeten Scratch-Puffer
aufgeloest werden, aber alle Draws muessen dieselben Daten rechtzeitig sehen.
Puffer nicht mehrfach ueberschreiben, bevor die zugehoerigen Draws ausgefuehrt
sind; pro Batch Submit/Recycling oder getrennte nicht ueberlappende Bereiche.

Die Animation benutzt weiterhin absolute Spielzeit, s1/s2, Biegung und hA.
Kein Neustart der Bewegungsphase nach Laden einer Zelle. Strandabbildung,
Blattkontur, Nah-/Fernreihen und bestehende Schattenabweichung bei bewegten
Pflanzen bleiben dieselben Regeln wie in der Referenz.

## Kosten sauber bilanzieren

Seien M Rezepte, N gehaltene Zielblaetter, F deren urspruengliche Fernmitglieder
und R/Rf gleichzeitig ausgepackte Cacheblaetter. Ein einfacher Ansatz ergibt:

- Alt: `36*(N+F)` GPU-Bytes fuer diese Teilmenge.
- Rezept plus separate Nah-/Fernverweise: `32*M + 4*(N+F)` Bytes, bei der
  CPU-Cache-Route primaer CPU-Daten, bei GPU-Rekonstruktion auch GPU-Daten.
  Tatsaechlich gehaltene Kopien beider Seiten getrennt zaehlen.
- CPU-Cache-Route zusaetzlich `36*(R+Rf)` GPU-Bytes und Upload-Scratch.
  Nach einem gemeinsam genutzten LOD-Puffer aendert sich diese
  Rechnung; dessen Einsparung nicht ein zweites Mal zaehlen.
- GPU-Direktvariante mit exakten empfindlichen Attributen zusaetzlich `8*N`
  Bytes. Weitere Ausrichtung/Bindings/Metadaten konkret mitzaehlen.

Fuer ein High-Cluster mit 8-21 Blaettern sind die Nahdaten heute 288-756 Byte;
das Rezept allein waere 32 Byte. Die kleinen Zahlen gelten nicht schon als
Gesamtersparnis: Zellverweise, LOD, Pools und Schatten-Scratch fehlen darin.

HTML: fuer CPU-Rezepte/Cache eher Wachstum durch Verwaltung und Decoder;
fuer GPU-Rezepte zeitweilig doppelte Generierungslogik in JS/WGSL. Keine
gemessene Bytezahl. Start: Stufe A langsamer; Cache/Schattenbake koennen weitere
Kosten verursachen. Laufzeit: moegliche Upload-Spitzen oder mehr ALU/Draws.
Physischer Prozess-/Treiberspeicher und Spitzenbedarf getrennt messen.

## Abnahme und Abbruchpunkt

Zuerst Datenprobe ohne GPU-Last. Wenn die unveraenderte Zielklasse nicht
bytegleich aus den Rezepten wiederherstellbar ist, keine CPU-Cache-Integration.
Vor einem GPU-Umbau die ermittelte absolute Klassenersparnis gegen einfaches
Packing und gemeinsam genutzte Nah-/Fernpuffer abwaegen.

Nach bestandener Datenprobe: je High/Medium/Low gleiche 1280x720, Kameras,
Renderdetail und Zeit. Sechs Weltblicke plus Typ-2-Cluster in 1-3 m Naehe,
Zellgrenze, Schattenempfaenger und Entfernungen an 24/58 m. Zeitreihen 30 Hz
und Kamerafahrten getrennt. Langsamer Zellwechsel, schneller Rueckweg,
360-Grad-Drehung und Spruenge 1-6; nach Cache-Verwerfen identische Pflanzen,
keine Phasenwechsel, kein Aufpoppen, keine fehlenden Schatten. Offline, Audio,
Auf-/Abtauchen und gleiche Kollisionsdaten pruefen.

CPU-Route: identische erzeugte Datensaetze und keine sichtbare Bildaenderung
erwarten. GPU-Route: Formfehler, diskrete Glitzerwechsel und Culling separat
ausweisen; keine stillschweigende Umdeutung zu einer optischen Verbesserung.
Eine bewusst neue Wuchsgrammatik gehoert in einen weiteren Gestaltungsversuch
mit eigener Baseline und darf keine Speicheroptimierung gleicher Inhalte heissen.

Abbrechen bzw. bei Stufe A belassen, wenn Cache/Pools den Gewinn aufzehren,
der statische Schattenbake grosse dauerhafte Kopien erzwingt, freie Bewegung
sichtbare Nachladefehler bekommt oder die kleine Klasse mehr HTML-/Laufzeit-
Komplexitaet erzeugt als ein vergleichbarer Packing-Gewinn rechtfertigt.

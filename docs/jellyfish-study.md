# Quallen statt schwebender Steine

Versuch auf Nutzerwunsch nach dem lokal gesicherten Fischstand `75920eb`.
Die bewusst schwebenden Felsgruppen aus dem Original werden ersetzt;
Bodensteine, Gelaende, Pflanzen, Fische, Mantas, Steuerung und Audio bleiben.
Produktquellen in `source/`, Referenz unter `experiments/optimizations/upstream/`
unveraendert. Dies war zunächst ein lokaler Versuch. Die spätere Veröffentlichungsfreigabe
und der um Credits ergänzte Release stehen in `docs/optimization-handoff.md`.

## Entscheidung und sichtbare Wirkung

**33 Quallen ersetzen 852 schwebende Haupt- und Begleitsteine.** Die bisherigen
Gruppenregionen aus `world.js`, `BOULD`, liefern Zentren und Verteilungsradien.
Pro Region entstehen hoechstens zwei Tiere; bis zu 24 Platzierungsversuche
suchen genuegend freien Raum fuer Schirm, Tentakel und Bewegung. Das vorhandene
Dichtefeld `Dw` prueft mehrere Hoehen, ohne neue Kollisionsdaten anzulegen.
Der feste Seed vor den Bodensteinen bleibt erhalten: Die geaenderte Zufallsfolge
der Quallen beeinflusst die nachfolgenden Weltbestandteile nicht.

`meshJelly()` baut ein einziges gemeinsames Modell: einen gewoelbten Schirm aus
acht Ringen mit je 24 Punkten, leicht gewelltem Rand und sechs duennen Tentakeln.
397 Vertices, 738 Dreiecke. Die drei Qualitaetsstufen verwenden dasselbe kleine
Modell und dieselben Instanzen. Alle vorherigen Modelle bleiben bytegleich.

`vsJelly` verwendet die vorhandenen Zeit-/Lichtdaten: langsames Schweben,
individuelle Pulsfrequenz und Phase, gegenlaeufige Breiten-/Hoehenaenderung des
Schirms und zunehmende seitliche Verzoegerung entlang der Tentakel. Die Bewegung
braucht keine CPU-Simulation oder Instanz-Uploads pro Bild. Der Materialshader
nutzt weiche milchige/rosa Farben, einen deutlicheren Rand und vier dezente
Innenringe. Keine Bildtextur, Lichtquelle, Emission oder zusaetzlicher Effektpass.

**Aesthetische Einschaetzung:** Der Blick durch die Schluchten ist offener;
die auffaelligen fliegenden Felsbrocken verschwinden. An ihre Stelle treten
wenige, langsam pulsierende Tiere, deren Durchsichtigkeit und nachziehende
Tentakel das Schweben plausibel machen. Nahe am Wrack sind Schirm und Bewegung
klar lesbar, im dunklen Kelp treten sie zurueck. Der Vorher-nachher-Vergleich
rechtfertigt den kleinen Zusatz im HTML. Es sind stilisierte Quallen mit
einfachen Tentakeln, keine anatomisch exakten Artmodelle.

Die Quallen nutzen eine neue transparente Pipeline und einen Instanzpuffer.
`main.js`, `drawJelly`, zeichnet sie unter Wasser nach der Wasseroberflaeche;
ab dem vorhandenen Linsen-Uebergang bei -0,06 m davor. Sonst wuerde die spaeter
gezeichnete Oberflaeche die transparenten Tiere uebermalen bzw. ihr Tiefenwert
sie direkt an der Wasserlinie verdecken. Alle Quallen bleiben deutlich tiefer
als dieser Uebergangsbereich. Die alte Sinusbewegung in `W_SOLID.vs` entfaellt:
Nach Entfernung der Schwebesteine haben alle verbleibenden Instanzen dort einen
Bewegungsparameter von null.

## Ressourcen

| Position | Vorher → Versuch / Differenz |
| --- | ---: |
| HTML | 107.000 → **108.902 B**, +1.902 B |
| gzip Level 9 | 43.241 → **43.825 B**, +584 B |
| Entfernte Fels-Instanzdaten | -40.896 B |
| Gemeinsames Quallenmodell auf der GPU | +10.780 B |
| Quallen-Instanzpuffer | +1.056 B |
| GPU-Puffer insgesamt, alle Stufen | **-29.060 B / -28,38 KiB** |
| Zusaetzliche Texturen / Renderpaesse | 0 / 0 |
| Zusaetzliche Pufferobjekte / Pipelines / Draws pro Bild | 1 / 1 / 1 |
| Quallendreiecke pro Bild | 24.354 |

Dateigroessen und Ressourcen-Deskriptoren sind gemessen. Die Dreiecksarbeit wird
aus Mesh-Indizes und Instanzzahlen berechnet. Auf High/Medium entfallen
1.090.560 Felsdreiecke pro Bild, auf Low 272.640; netto sind es damit
1.066.206 bzw. 248.286 weniger Dreiecke. Die entfernten Felsen fehlen auch im
einmaligen Schatten-Bake. **Das ist ein gewollter Inhaltsaustausch**, kein
Leistungsgewinn bei identischer Szene. Veraenderte Verdeckung und Schatten
beeinflussen die Renderkosten ebenfalls; die Quallen kosten selbst neue
Vertex-/Fragmentarbeit und Transparenz-Overdraw.

CPU: Die temporaeren Typed Arrays des neuen Meshs belegen 15.208 B, weil der
Builder erst Uint32-Indizes erzeugt. Die gemeinsamen Uploadarrays und der
Instanzpuffer aendern sich entsprechend den obigen Groessen; die Vorlagen werden
nach dem Upload freigegeben. Kein neuer dauerhaft gehaltener CPU-Geometriesatz.
JS-Listen, Treiber-/Pipeline-Overhead sowie Prozess-/Spitzenspeicher wurden nicht
gemessen. Die GPU-Bytebilanz ist keine Aussage ueber die gesamte RAM-Belegung.

Separate Zeitmessung: eine Aufwaermrunde, drei Messrunden je Stufe/Version,
zwei Ansichten mit je 20 Aufwaerm- und 60 Messbildern. Mediane der Seitenwerte:

| Stufe | Startmenue vorher → nachher | GPU Pose 1 vorher → nachher | GPU Quallen-Nahansicht vorher → nachher |
| --- | ---: | ---: | ---: |
| High | 2.405,4 → 2.364,8 ms | 11,272 → 10,879 ms | 7,537 → 7,864 ms |
| Medium | 2.263,4 → 2.251,3 ms | 8,880 → 8,520 ms | 6,128 → 6,357 ms |
| Low | 2.276,0 → 2.189,5 ms | 3,473 → 3,408 ms | 2,425 → 2,425 ms |

Die Nahansicht wird auf High **0,328 ms**, auf Medium **0,229 ms** teurer,
obwohl Dreiecke wegfallen. Die jetzt sichtbare Umgebung und transparenten
Quallen veraendern die Fragmentarbeit. Pose 1 wird um 0,393 / 0,360 / 0,066 ms
guenstiger. Das ist keine pauschale Beschleunigung. CPU-Encoding-Mittelwerte
pro Seite unterscheiden sich im Median um etwa 0 bis +0,035 ms.

**Einschraenkung der Zeitmessung:** Zwei Browserlaeufe brachen mit einem
`Runtime.evaluate`-Timeout ab, einmal beim Kandidaten und einmal bei der
Baseline. Chrome protokollierte DisplayLink-/Mailbox-Fehler. Alle 17 zuvor
vollstaendigen Faelle wurden erhalten; nach erneutem Aufwaermen wurden vier
weitere Faelle erfasst, die letzten drei schliesslich in je einem eigenen
Browserprozess mit einem Aufwaermstart. Kein vollstaendiger langsamer Fall
wurde verworfen. Alle geplanten 24 Faelle liegen damit vor, einschliesslich
der sechs initialen Aufwaermfaelle; Rohdaten und Wiederaufnahme stehen in
`timing-interrupted.json`, `timing-retry.json`, `timing-single-*.json` und
`summary.json`. Die Startzeiten streuen deutlich, beispielsweise Medium
Kandidat 2.219–2.474 ms. Daraus keinen allgemeinen Startzeitgewinn ableiten.
Die GPU-Werte sind serialisierte Renderzeitstempel auf diesem Mac, keine
Gameplay-FPS; Browserunterbrechungen und wechselnde Prozesse begrenzen die
Aussagekraft zusaetzlich. Die abschliessenden normalen Offline-Starts sind
separat und auf allen drei Stufen erfolgreich (`shipping.json`).

## Nachweise und Grenzen

Reproduktion: [`experiments/jellyfish/RUN.txt`](../experiments/jellyfish/RUN.txt).
Separate normale, QA- und Timing-Builds. Chrome 157 / Apple Metal, 1280x720,
Detailfaktor 1, alle drei Qualitaetsstufen. Eigenes Headless-Profil, offline,
Pointer Lock unterdrueckt; kein Zugriff auf die physische Maus.

- **378 Vergleichsbilder**, 63 je Version/Stufe: sechs urspruengliche
  Weltansichten, Gruppen-/Gesamtansichten, Nahansichten von verschiedenen
  Seiten und Wasserlinienansichten. Identische Kameras, Aufloesung und Zeiten.
  Zwei Folgen mit zwoelf 30-Hz-Schritten, ein 8,4-s-Pulszyklus mit zwoelf Schritten,
  spaetere Zeitpunkte und sieben Hoehenschritte beim Auftauchen. Keine neuen
  auffaelligen Spruenge in den geprueften Folgen. Low zeigt wie bisher staerkere
  Pixelkanten, besonders an den duennen Tentakeln.
- 135 bisherige Datenhashes inklusive des gefilterten Bodenstein-Datensatzes
  bleiben gleich. Nur die schwebenden Solid-Datensaetze entfallen; neu sind
  Quallen-Instanzen und Modell 27. Bestehende Fisch-Draws bleiben exakt gleich.
- Ressourcenpruefung bestaetigt ausschliesslich die erwarteten Aenderungen.
  Alle sonstigen Puffer, Texturdeskriptoren, Vertexlayouts und Pipelines bleiben.
- Ein Geometrietest prueft endliche Positionen, normalisierte Normalen,
  nach aussen gerichtete Schirmnormalen, gueltige Indizes und nicht degenerierte
  Dreiecke. Die CPU-/GPU-Mittelpunkte weichen bei t=8 s hoechstens um
  0,0000042 m ab; diese Kontrolle steht getrennt in `summary.json`.
- Der CPU-Bewegungscheck wertet die Shaderformeln fuer alle 397 Vertices aller
  33 Tiere bei jeder vollen Sekunde von 0 bis 180 aus: **2.371.281 Abfragen je
  Stufe**. Kleinster Feldabstand 0,509 m, hoechster Vertex -6,417 m. Kleine
  JS-/WGSL-Rundungsunterschiede sind moeglich. Es sind zeitliche Stichproben
  gegen das Gelaende, kein kontinuierlicher Kollisionsbeweis und keine Pruefung
  gegen jedes Blatt oder jedes separate Dekorationsobjekt.
- Die erste Platzierung unterschritt mit 0,0497 m knapp die geforderte Reserve
  von 5 cm. Sie wurde verworfen und mit groesserem Abstand erneut geprueft;
  `results/screening.json` bewahrt diesen Befund.
- Bewegung, Menue, Mute/Unmute, laufender Audiokontext und Offline-Betrieb
  bestanden. Der normale Produkt-Build wird separat auf allen drei Stufen
  gestartet und gegen den normalen Kandidaten bytegenau verglichen.

Einige Baseline-Nahansichten werden von den danach entfernten Felsen verdeckt.
Deshalb sind selbst grosse Bilddifferenzen kein Qualitaetsmass. Die Vergleiche
dokumentieren einen gewollten Szenenwechsel. Transparenz ist eine einfache
Alpha-Mischung ohne Brechung oder aufwendige Sortierung aller durchsichtigen
Flaechen; bei Ueberlagerungen bleiben entsprechende Naeherungen bestehen.

## Uebernahme und Rueckweg

Der Quallenversuch ist nach dem sichtbaren Vergleich in `source/` und im normalen
`index.html` uebernommen. Die Variante bleibt separat ruecknehmbar:
`experiments/jellyfish/jelly-only.patch` umkehren und normal bauen. Damit kehren
die bisherigen Schwebesteine zurueck; der akzeptierte Fischstand bleibt erhalten.
Dies war zunächst ein lokaler Versuch. Die spätere Veröffentlichungsfreigabe
und der um Credits ergänzte Release stehen in `docs/optimization-handoff.md`.

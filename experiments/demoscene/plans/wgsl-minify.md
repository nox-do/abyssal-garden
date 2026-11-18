# Plan: konservative WGSL-Minifizierung

**Go fuer einen kleinen Build-Versuch; geringe Prioritaet gegenueber den
Speicherideen.** Zuerst ausschliesslich interne WGSL-Helferfunktionen kuerzer
benennen. EntryPoints, Overrides, Struct-Felder, Shaderarithmetik und die
gemeinsam genutzten Quellfragmente erhalten. Ein allgemeiner Shadercompiler
oder ein neuer Laufzeit-Entpacker ist fuer diesen ersten Umfang nicht noetig.

Basis: `3178034`, 18.11.2026. AGENTS.md und optimization-handoff gelesen.
Dieser Agent hat nur Quellen und Spezifikation gelesen, eine statische
In-Memory-Groessenprobe gerechnet und diesen Plan geschrieben. Keine
Produktdatei, kein Build-Artefakt und keine eingefrorene Referenz geaendert;
kein Browser gestartet. Die anderen Agenten arbeiten getrennt an ihren Themen.

## Was der aktuelle Build tut und noch offen laesst

`source/build.mjs:27` entfernt aus 16 mit `/*wgsl*/` markierten Template-
Literalen Zeilenkommentare und verkuerzt Leerraum. Anschliessend minifiziert
esbuild JavaScript/CSS. Der Inhalt der WGSL-Strings bleibt fuer den JS-Minifier
weitgehend undurchsichtig: interne Namen wie `coastPosition` oder `leafWidth`
bleiben lang. Viele aeltere Namen sind ohnehin nur ein bis drei Zeichen lang.

Konkrete Grenzen der Regex-Loesung: Sie kennt keine WGSL-Blockkommentare
einschliesslich deren Verschachtelung, prueft keine Token-Grenzen nach dem
Entfernen von Leerraum und behandelt JS-Interpolationen als Teil des WGSL.
Bei kuenftigen Ausdruecken wie `a - -b` koennte so `a--b` entstehen. Auch die
Template-Erkennung bis zum naechsten Backtick versteht keine escaped oder
verschachtelten Backticks. Das sind Grenzen des Werkzeugs, keine nachgewiesenen
Bildfehler. Den bestehenden Whitespace-Schritt deshalb nicht aggressiver
machen; neue Umbenennung davor getrennt und tokenbasiert absichern.

Weitere theoretische Moeglichkeiten waeren lokale Variablen, Typ-/Feldnamen,
Literal-Schreibweisen und unbenutzte Deklarationen. Diese sind nicht Teil des
ersten Versuchs: Weniger Typ-/Scope-Risiko ist bei dem begrenzten verbleibenden
Namenspotenzial wichtiger als eine maximale Transformationsliste.

Die Source-Struktur ist fuer den Footprint bereits hilfreich:

- `W_NOISE` wird von `W_DENS` und `W_DETAIL` wiederverwendet.
- `W_FS` liefert die gemeinsame Vollbild-Vertexfunktion.
- `S_G` enthaelt globale Szenenfunktionen und wird durch `S_B` erweitert.
- `W_SOLID`, `W_LEAF`, `W_ANIM`, `W_SURF` und `W_SPR` teilen `S_B`;
  `W_RAYS` und `W_POST` teilen `S_G`.

Ein Minifier, der erst alle fertigen Shader ausbreitet und anschliessend jeden
einzeln in die HTML-Datei schreibt, koennte diese Wiederverwendung verlieren
und die Datei vergroessern. Die gemeinsame Fragmentstruktur muss bleiben.

## Konkreter erster Umfang

Ein deterministisches, buildseitiges Mapping fuer interne Funktionsnamen mit
mehr als drei Zeichen. Immer dasselbe Mapping ueber alle WGSL-Fragmente
anwenden, weil Definition und Verwendung haeufig in verschiedenen Literalen
liegen. Zielnamen muessen in allen Originalfragmenten unbenutzte, gueltige
Identifier sein; eine konservative Reihe `Q0`, `Q1`, ... reicht hier aus.

1. Die bestehenden WGSL-Literale erkennen und ihre JS-Interpolationsausdruecke
   gesondert erhalten. Nicht das gesamte JavaScript nach WGSL-Namen ersetzen.
2. WGSL lexikalisch in Kommentare, Identifier, Zahlen und Interpunktion zerlegen.
   Ganze Identifier bearbeiten, keine Substrings und keine Zahlenbestandteile.
   Ein spaeter ergaenzter Blockkommentar darf keine Umbenennung ausloesen.
3. Eine explizite, versionierte Helferliste verwenden. Fuer jeden Eintrag
   pruefen: nur Funktionsdefinitionen und direkte Aufrufe; keine gleichnamige
   Variable, kein Parameter, Struct-Member, Override, Typ oder EntryPoint.
   Bei anderer Verwendung den Build mit einer konkreten Meldung abbrechen.
4. Frische Zielnamen gegen **alle** Identifier, WGSL-Schluessel-/reservierten
   Woerter und unveraenderte JS-Interpolationsnamen pruefen. Ein Helfer darf
   nicht durch einen neuen lokalen Namen verdeckt werden.
5. Nur die erkannten Identifier-Tokens ersetzen, danach den vorhandenen
   Whitespace-Minifier und esbuild ausfuehren. Keine Ausdrucksumstellung,
   Zahlenrundung, Funktionsinline-Entscheidung oder Dead-Code-Entfernung.
6. Mapping und Quellhashes im Experimentbericht speichern. Readable-/Dev-Builds
   bleiben lesbar und benutzen die Originalnamen.

Dieser eingeschraenkte Weg benoetigt einen kleinen lokalen Lexer/Validator,
aber keinen vollstaendigen WGSL-AST und keine zusaetzliche npm-Abhaengigkeit.
Die Rohprobe unten ist noch **nicht** dieser abgesicherte Minifier; sie zeigt
lediglich die Dateigroesse der vorgesehenen Umbenennungen.

## Interfaces und Stolperstellen

**EntryPoints:** `main.js` benutzt Namen als JavaScript-Strings, teils indirekt
ueber Helperargumente. Die 20 verschiedenen Namen bleiben erhalten:
`main`, `vs`, `fs`, `fsMip`, `fsDown0`, `fsDown`, `fsUp`, `fsSh`, `vsGl`,
`fsGl`, `vsFish`, `fsFish`, `vsManta`, `fsManta`, `vsB`, `fsB`, `vsBub`,
`fsBub`, `vsSnow`, `fsSnow`. Einzelne Namen kommen in mehreren Modulen vor.
WebGPU loest diese Namen gegen den ausgewaehlten Shader und dessen Stage auf.
[WebGPU: EntryPoint-Auswahl](https://gpuweb.github.io/gpuweb/#abstract-opdef-get-the-entry-point)

**Overrides:** `ROWS`, `CUTOUT` und `FAR` werden in `main.js:102-114` per Namen
gesetzt. Sie bleiben einschliesslich Defaultwerten erhalten. Eine Umbenennung
wuerde auch die JS-`constants`-Keys betreffen; ein WGSL-interner Austausch
allein waere falsch. IDs mit `@id` waeren eine eigene, hier unnoetige Aenderung.
[WGSL: override declarations](https://gpuweb.github.io/gpuweb/wgsl/#override-declarations)

**Scopes:** WGSL erlaubt lokale Deklarationen, die andere Namen verdecken.
Ein spaeterer allgemeiner Minifier muss Referenzen auf geloeste Deklarationen
abbilden, statt bloss Wortvorkommen zu ersetzen. Unser erster Umfang umgeht
diese Komplexitaet durch die strikte Verwendungskontrolle und global frische
Namen. Bei einer neuen kollidierenden Deklaration abbrechen.
[WGSL: Scope](https://gpuweb.github.io/gpuweb/wgsl/#scope)

**Struct-Felder und Attribute:** Felder wie `g.cam`, `i.edge` oder `o.wp`,
Swizzles wie `.xyz`, Layout-/Stage-Attribute und Builtins nicht veraendern.
Namensgleichheit bedeutet hier nicht dieselbe Variable. Feldreihenfolge,
Typen, `@location`, `@binding`, `@group`, `@builtin` und Interpolation bleiben
vollstaendig erhalten; damit bleiben auch die vom JS gepackten Layouts gleich.

**JS-Interpolation:** `WATER`, `SHADOW`, `RAYN`, `LV > 1` und
`AA > 1 ? '_multisampled' : ''` werden erst beim Ausfuehren des JS eingesetzt.
Die Minifizierung darf diese Ausdruecke nicht als WGSL behandeln. Der letzte
Fall setzt sogar einen WGSL-Typnamen aus drei Textteilen zusammen. Deshalb
alle resultierenden Module pro Qualitaetsstufe zusaetzlich pruefen.

## Statisch belegtes Potenzial

Eine reine In-Memory-Groessenprobe mit dem vorhandenen esbuild (Node v22.23.4)
reproduzierte die Baseline bytegleich. Keine Datei erzeugt. Dabei wurden nur
folgende 27 Helfernamen in Quellreihenfolge auf `Q0` bis `Qq` verkuerzt:

`smax`, `smin`, `seg2`, `seg3`, `dens`, `uvOf`, `caus`, `airSky`,
`coastShape`, `coastPosition`, `coastNormal`, `fogIn`, `shUV`, `shadow1`,
`shadow4`, `shadow9`, `caus2`, `sunE`, `zone`, `side`, `qrot`, `sway`,
`shape2`, `leafWidth`, `quad`, `tmap`, `sat3`.

| Variante | HTML | gzip Level 9 | Differenz |
| --- | ---: | ---: | ---: |
| Baseline 3178034 | 105.121 B | 42.433 B | — |
| Nur diese Helfernamen kuerzer | 104.703 B | 42.372 B | -418 B HTML / -61 B gzip |

Baseline SHA-256:
`f3fd418f1a34f3729f86c460d24f51ccccc8ad635400308e7721e387ecdf1fd6`.
Rohprobe SHA-256:
`3ccc9895c3071b1a3db2f76d4a4544a5a65ff2032821511472dfc8c051ecd920`.

Das ist ein Groessenbefund, kein Shader-Compile-, Bild- oder Leistungsnachweis.
Eine andere Zuordnung gleich langer Namen kann die gzip-Groesse aendern;
kleinste Rohdatei und kleinste gzip-Datei sind verschiedene Ziele.

Die gezaehlten GPU-Puffer und Texturen werden dadurch nicht kleiner. Die
ausgelieferte Datei bekommt keinen neuen Parser/Decoder; der Validator bleibt
Build-Werkzeug. String-/Compiler-RAM und Startzeit sind ungeprueft. Keine
laufende GPU-Zeitersparnis aus kuerzeren Namen erwarten oder versprechen.

## Pruefplan vor einer Uebernahme

- Eigenes Experiment gegen 3178034, etwa `wgsl-build.json`, `wgsl-browser.json`,
  keine alten surface/leaves-Berichte ueberschreiben und keine Kombination
  mit Shadow16 oder Shared-Leaves waehrend der ersten Beweisfuehrung.
- Lexerfaelle: gleichnamiger lokaler Parameter, `foo` gegen `foobar`, Member
  und Swizzle, Zahlen mit Exponenten, Kommentare, Attributnamen und geschuetzte
  Template-Interpolationen. Bei ununterstuetztem Fall fail-closed.
- Fuer jedes der 12 fertigen Shader-Module und LV 0/1/2 die Interpolationen
  auswerten. Transformierte Identifier per Rueckmapping zuruecksetzen; der
  resultierende WGSL-Tokenstrom muss exakt der Baseline entsprechen. Diese
  Pruefung muss Zahlen, Operatoren, Typen und Attribute mit erfassen.
- Alle Compute-/Renderpipelines erzeugen, nicht bloss `createShaderModule`:
  Shader-Compilation-Infos, ErrorScopes und uncaptured errors pruefen. Gerade
  Blattvarianten mit 9/5/3 Reihen, `FAR=70`, CUTOUT, Shadow-Fragment und Glints
  muessen mit ihren tatsaechlichen EntryPoints/Overrides entstehen.
- Drei Qualitaetsstufen, feste Gesamt-/Nahbilder, Wasserlinie, Strand und kurze
  Zeitsequenzen vergleichen. Bei reiner Umbenennung wird Bildgleichheit
  erwartet; Abweichungen zuerst untersuchen, nicht als neue Gestaltung werten.
- Welt-/Mesh-/Kollisionshashes, Layouts und alle GPU-Allokationsdeskriptoren
  gleich. Offline-, Menue-, Audio- und kurzer Bewegungscheck am normalen Build.
  Test-Chrome eigenes Profil, Pointer Lock unterdrueckt, keine parallele GPU-Last.
- Ein separater Startzeitvergleich ist nur noetig, wenn eine relevante
  Verzoegerung auffaellt oder ein Startzeitgewinn behauptet werden soll.

## Empfehlung und Abbruchpunkt

Dieser kleine Ansatz kann rund 0,4 kB aus der aktuellen HTML-Datei nehmen und
passt gut als unabhaengiger Build-Versuch. Gegen 20-30 MiB Laufzeitspeicher
ist seine Wirkung jedoch klein. Wenn bereits der konservative Validator
unangemessen kompliziert wird oder der Browservergleich abweicht, diesen
Versuch zurueckstellen; nicht fuer wenige hundert Byte einen allgemeinen
Shadercompiler selbst bauen.

Ein spaeteres vollstaendiges Scope-/Feld-Mangling braucht einen versionierten
WGSL-Parser und eine aufgeloeste Symboltabelle samt Modul-Komposition. Dessen
Abhaengigkeiten gehoeren nur in den Build, ihre Groesse ist nicht mit
Liefergroesse gleichzusetzen. Konkretes Parserpaket, Wartungsaufwand und
zusaetzlicher Bytegewinn sind in diesem Plan nicht nachgewiesen. Der bekannte
gzip-Loader bleibt ein getrenntes Experiment und wird hier nicht mitgerechnet.

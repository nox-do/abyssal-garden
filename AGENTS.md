# Abyssal Garden: Einstieg fuer neue Chats

Lies zuerst `docs/optimization-handoff.md`. Dort stehen Ausgangspunkt,
nachgewiesene Ergebnisse, Grenzen der Tests und moegliche naechste Schritte.

## Projekt und Ziel

- Unser Fork: https://github.com/nox-do/abyssal-garden (`origin`).
- Original: https://github.com/Noniv/abyssal-garden (`upstream`).
- Eine prozedurale, frei erkundbare Unterwasserwelt mit WebGPU und Web Audio,
  komplett in einer offline nutzbaren HTML-Datei. MIT, Copyright Maksymilian Dendura.
- Ziel unserer Untersuchung: weniger Dateigroesse, Speicher und unnoetige
  Rechenarbeit bei erhaltenem Szeneninhalt, Erscheinungsbild und Verhalten.
- Die urspruenglichen Optimierungen liegen als getrennte Experimente vor.
  Spaetere, ausdruecklich integrierte Produktaenderungen sind unten aufgefuehrt;
  nicht alle frueheren Kandidaten sind in `source/` oder `index.html` enthalten.
- Die spaetere Materialkorrektur fuer Schwaemme/Korallen ist in `source/` und
  `index.html` integriert; siehe `docs/visual-quality-study.md`.
- Ein reversibler Blattkonturversuch ist inzwischen ebenfalls in `source/` und
  `index.html`: mathematischer Randschnitt, gleiche Dreieckszahl und gleiche
  Bewegungsparameter. Siehe `docs/leaf-quality-study.md` und `experiments/leaves/`.
  Referenz vor den Blattarbeiten ist lokal `461db8a`. Blatt-, Auftauch-,
  Ufer-, Strand- und Speicherarbeiten gehoeren zum folgenden Sicherungsstand.
  Die vorhandene Bewegung gefaellt dem Nutzer und soll erhalten bleiben.
- Zusaetzlich ist der beauftragte Auftauchversuch in `source/` und `index.html`:
  Augenhoehe maximal +0,28 m, vorhandene Kueste 1,5-3 m, kein Landgang.
  Siehe `docs/surface-study.md` und `experiments/surface/`. Eigener Rueckweg:
  `surface-only.patch` erhaelt den vorherigen Blatt-/Materialstand.
  Nach Nutzerfeedback reicht das Kollisionsfeld jetzt bis zur aeusseren Kueste;
  die Sicherheitsgrenze liegt bei 180 statt 150 m hinter dem Felsrand.
  Nachweise getrennt in `experiments/surface/results/boundary-*.json`.
- Nach Review und Nutzerfreigabe sind CPU-Aufraeumen nach Upload und Uint16-
  Objektindizes integriert. `memory-summary.json`: 2,5-2,7 MiB Array-Nutzdaten
  freigegeben, 0,45-0,52 MiB kleinerer GPU-Indexpuffer; keine RSS-Garantie.
- Eine einzelne westliche Sandbucht (um x=-170,z=10) ist als Versuch integriert.
  Bestehende Topologie/Instanzen, lokale Hoehenabbildung samt inverser Kollision,
  freier Bodenfarbenkanal fuer Sand. `beach-*.json`, `beach-only.patch` und
  `memory-only.patch` unter `experiments/surface/`. Fuer Ruecknahme des gesamten
  Auftauchens zuerst den Strand-Patch umkehren; der danach verwendete aktualisierte
  `surface-only.patch` erhaelt Blatt-, Material- und Speicheroptimierungen.
- Demoscene-Fortsetzung auf Branch `codex/demoscene-memory`: Sicherung davor
  ist `3178034`. Geteilter Nah-/Fern-Blattpuffer und 16-Bit-Schattenkarte sind
  nach Vergleich in Produktquellen/index.html integriert und auf Nutzerwunsch
  lokal gesichert; nichts gepusht.
  Siehe `docs/demoscene-study.md` und `experiments/demoscene/RUN.txt`.
  HTML 105.306 B (+185 B), nominal -55,005/-20,147/-14,719 MiB GPU-Ressourcen
  High/Medium/Low bei 1280x720; keine Prozess-RAM-Messung. Shared-Far pixelgleich,
  Schatten mit kleinen Kantenabweichungen. Separate Ruecknahmepatches vorhanden.
  Fuenf Agentenplaene liegen unter `experiments/demoscene/plans/`; Packing,
  Pflanzenrezepte und WGSL-Minifizierung sind weiterhin nicht implementiert.
- Flache Fischgruppen als lokal gesicherter Versuch ab `cc3d14b`:
  56 blau-gelbe/gelbe Fische in sieben Gruppen, Zentren 3,8-7 m tief.
  Erste Version: +1.792 B Fischpuffer, HTML 106.554 B (+1.248 B).
  Siehe `docs/fish-study.md` und `experiments/fish/RUN.txt`; separater
  `fish-only.patch`. Die bisherigen 4.240 Fische und alle anderen Weltdaten
  bleiben erhalten. Pointer Lock bleibt in allen Testseiten unterdrueckt.
- Nach Nutzerfeedback sind nur diese 56 Fische gerundet: eigenes kleines
  Modell, nach aussen gerichtete Normalen, ein zusaetzlicher Draw. Weitere
  +446 B HTML / +3.020 B GPU-Modelldaten. Fischstand: **107.000 B HTML**;
  Details in `docs/fish-shape-study.md` und `experiments/fish-shape/RUN.txt`.
  Alle bisherigen 133 Datenhashes und Bewegungsparameter unveraendert;
  282 Vergleichsbilder auf drei Stufen. Auf Nutzerwunsch lokal committed,
  nichts gepusht. Fuer Ruecknahme
  aller Fische zuerst `shape-only.patch`, dann `fish-only.patch` umkehren.
- Danach auf Nutzerwunsch Quallen statt schwebender Felsgruppen als neuer
  Versuch: 33 Quallen ersetzen 852 Schwebesteine, Bodensteine bleiben exakt.
  Basis `75920eb`, aktuell **108.902 B HTML** (+1.902 B), nominal -29.060 B
  GPU-Pufferdaten; ein neues Modell, Instanzpuffer und transparenter Draw.
  `docs/jellyfish-study.md`, `experiments/jellyfish/RUN.txt` und eigener
  `jelly-only.patch`. Unter-/Ueberwasser-Reihenfolge umfasst den bestehenden
  Linsen-Uebergang ab -0,06 m. Noch nicht committed; kein Push.

## Veröffentlichung (19.11.2026)

- Nutzer hat Aufräumen, Commit, Push und GitHub-Pages-Veröffentlichung beauftragt.
- Aktueller Release-Build samt Credits/MIT: 110.422 B HTML, 44.704 B gzip.
  Szenen-JavaScript bytegleich zum geprüften 108.902-B-Quallenstand; alte
  Berichte und Größen sind historische Schrittnachweise.
- README beschreibt integrierte Änderungen und verlinkt Footprint/GPU-Nachweise.
  `docs/publication-report.json` und separater `publication-shipping.json`
  dokumentieren den Releasecheck auf allen drei Stufen.
- `.github/workflows/pages.yml` veröffentlicht bei Push auf `main` nur HTML
  und LICENSE nach reproduzierbarem Build. Ziel ist
  https://nox-do.github.io/abyssal-garden/ ; Erfolg nach Push prüfen.
- Copyright/Originalautor Maksymilian Dendura (Noniv) erhalten; sichtbare
  Fork-Credits und Original-/Supportlinks im Menü, MIT im Standalone-HTML.

## Code und Builds

- Lesbare Produktquellen: `source/src/`, HTML/CSS: `source/template.html`.
- `source/build.mjs` verbindet die Dateien in festgelegter Reihenfolge; sie
  teilen einen Scope. Reihenfolge und Abhaengigkeiten beim Umbau beachten.
- Normaler Build: `cd source && npm ci && npm run build`.
- Lesbarer Build: `npm run build:readable`; Entwicklerwerkzeuge: `npm run build:dev`.
- `index.html` ist generiert. Produktkorrekturen in den Quellen vornehmen.
- `experiments/optimizations/upstream/` ist ein eingefrorener Referenzstand.
  Fuer neue Experimente Transformationen in `build-variants.mjs` ergaenzen,
  nicht die Referenz passend machen.

## Experiment

- Eigenstaendiges Paket: `experiments/optimizations/`, Node 24.22.1.
- Setup: `npm ci --ignore-scripts --prefix experiments/optimizations`.
- Build: `npm --prefix experiments/optimizations run build`.
- Datenpruefungen: `npm --prefix experiments/optimizations run test:data`.
- Browserpruefungen: `npm --prefix experiments/optimizations run test:browser`.
  Der vorhandene Runner nutzt macOS Chrome in einem eigenen temporaeren Profil.
- Zusammenfassung: `npm --prefix experiments/optimizations run summarize`.
- Details: `experiments/optimizations/RUN.txt` und `results/summary.json`.
- Builds und Tests ueberschreiben die betreffenden Ergebnisdateien.
  Historische Browserberichte enthalten absichtlich die damaligen Staticseal-Pfade.

## Aussagen und Nachweise

- Sicher belegte Einsparung der lokalen HTML-Datei: 99.514 auf 56.506 Bytes,
  also 43.008 Bytes / 43,218 %. Entpacktes JavaScript ist bytegleich.
- Das ist keine entsprechende Einsparung bei bereits gzip-komprimiertem HTTP.
- Browserbilder wurden auf einem Mac mit Chrome 157 verglichen. Daraus keine
  allgemeine Browser-, Leistungs- oder Speichergarantie ableiten.
- Datenpruefungen, Bildvergleiche und Performancemessungen getrennt bewerten.

Beim Einstieg den aktuellen Git-Status pruefen. Der untersuchte Stand wurde
am 18.11.2026 auf Nutzerwunsch lokal gesichert; die spätere Freigabe für Push und Veröffentlichung steht im Abschnitt oben.

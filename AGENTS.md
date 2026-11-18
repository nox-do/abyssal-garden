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
am 18.11.2026 auf Nutzerwunsch lokal gesichert; ein Push ist nicht beauftragt.

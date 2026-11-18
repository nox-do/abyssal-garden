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
- Die Optimierungen sind bisher Experimente. Der normale Renderer und das
  ausgelieferte `index.html` wurden beim Uebernehmen der Experimente nicht geaendert.
- Die spaetere Materialkorrektur fuer Schwaemme/Korallen ist in `source/` und
  `index.html` integriert; siehe `docs/visual-quality-study.md`.
- Naechster Schwerpunkt: weniger eckige Blaetter. Die vorhandene Bewegung
  gefaellt dem Nutzer und soll erhalten bleiben; zuerst Kontur und Normalen pruefen.

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

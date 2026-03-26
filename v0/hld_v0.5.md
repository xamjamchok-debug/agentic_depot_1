# Fachliches High Level Design
## Agentic Depot-Analyse System — MoMo
**Version 0.5 | Stand: 2026-03-26**

---

## 1. Zweck & Abgrenzung

MoMo ist ein persönliches, agentengesteuertes Analyse-System für ein Wertpapierportfolio über mehrere Broker. Es nimmt heterogene Eingaben entgegen (PDF, CSV, Screenshot, Excel), normalisiert diese in ein einheitliches Datenmodell, führt KI-gestützte Analysen durch, speichert auf expliziten Befehl und sendet aktive Alerts bei relevanten Ereignissen.

**Explizit ausgeschlossen (heute):**
- Mehrere Nutzer / Multi-Tenancy
- Steuerliche Berechnungen (Vorabpauschale, Verlustverrechnungstopf)
- Zielallokations-Rebalancing mit konkreten Beträgen
- Orderausführung / Broker-API-Anbindung

---

## 2. Akteure & Rollen

| Akteur | Beschreibung |
|---|---|
| Nutzer (Joerg) | Laedt Daten hoch, erteilt Kommandos, empfaengt Analysen & Alerts |
| Orchestrator | Kern des Systems — Intent-Erkennung, Workflow-Steuerung, Prompt-Bau |
| LLM (Claude primaer) | Normalisierung, Interpretation, Themen-Klassifizierung, Empfehlungen |
| OCR-Komponente | Wandelt PDF & Screenshots in strukturierten Text |
| News/Web-API | Live-Recherche zu Treibern, Marktereignissen (zwingend) |
| Marktdaten-API | Zeitreihen fuer Volatilitaet & Drawdown (kostenlose Quelle) |
| Persistenzschicht | Snapshots, Positionen, Cashflows, Alerts |
| Alert-Engine | Ueberwacht Schwellwerte, pusht Benachrichtigungen |

---

## 3. Broker & Input-Formate

| Broker | Primaerformat | Weitere Formate | Besonderheit |
|---|---|---|---|
| DKB | CSV-Export | Screenshot (Handy), PDF | Enthaelt Einstiegskurs direkt |
| comdirect | PDF-Export | Screenshot, CSV | Kaufkurs & Kaufwert im PDF |

**Grundprinzip:** Das System akzeptiert was verfuegbar ist. PDF ist Standard, CSV ist bevorzugt (kein OCR-Fehlerrisiko), Screenshot ist Fallback wenn schnell vom Handy.

---

## 4. Datenmodell

### 4.1 Snapshot
```
snapshot_id          -- YYYYMMDD-HHMM-{broker}-{depot_id} (deterministisch)
timestamp_berlin     -- Pflicht (YYYY-MM-DD HH:MM Europe/Berlin)
broker               -- dkb | comdirect
depot_id             -- Depotnummer
portfolio_value_eur  -- Gesamtwert laut Broker-Dokument
source_format        -- csv | pdf | screenshot | xlsx
notes
```

### 4.2 Position
```
snapshot_id          -- Fremdschluessel
instrument_key       -- ISIN wenn vorhanden, sonst WKN (broker-uebergreifend eindeutig)
isin
wkn
name_raw             -- Originalbezeichnung aus Quelle
asset_class          -- ETF | Aktie | Anleihe | Derivat | Rohstoff | ...
region               -- DE | EU | US | EM | Global | Asien | ...
sector               -- Technologie | Gesundheit | Energie | Rohstoffe | ...
theme                -- LLM-vergeben: z.B. "Kern-Wachstum", "Emerging Markets"
quantity
price                -- Aktueller Kurs
entry_price          -- Einstands-/Mischkurs (geliefert oder berechnet)
market_value_eur
purchase_value_eur   -- quantity x entry_price
unreal_pl_eur
unreal_pl_pct
currency             -- EUR | USD | ... (mit FX-Hinweis wenn nicht EUR)
```

### 4.3 Cashflow
*(nur depot-relevante Transaktionen)*
```
date
broker
amount_eur
type                 -- buy | sell | dividend | fee | tax | deposit | withdrawal
instrument_key       -- leer bei reinen Geldein/-ausgaengen
quantity             -- optional (bei Kauf/Verkauf)
price                -- optional (Ausfuehrungskurs)
memo_raw
```

### 4.4 Alert-Log
```
alert_id
timestamp_berlin
alert_type           -- threshold_breach | drawdown | news_event | snapshot_delta
instrument_key       -- optional
message
severity             -- info | warn | critical
acknowledged         -- bool
```

---

## 5. Systemarchitektur

```
+----------------------------------------------+
|              INPUT-KANAELE                    |
|  Chat UI  |  Datei-Upload  |  Handy-Upload   |
+---------------------+------------------------+
                      |
+---------------------v------------------------+
|           ORCHESTRATOR (Azure)               |
|                                              |
|  +--------------+   +--------------------+   |
|  | Intent-      |   | Workflow-Engine    |   |
|  | Erkennung    |-->|                    |   |
|  +--------------+   | P1 Depot-Intake    |   |
|                     | P2 Cashflow-Intake |   |
|  +--------------+   | P3 Analyse         |   |
|  | Prompt-      |<--| P4 Persistenz      |   |
|  | Builder      |   | P5 Vergleich       |   |
|  +------+-------+   | P6 Alert-Check     |   |
|         |           +--------------------+   |
+---------+------------------------------------+
          |
+---------+--------+----------+---------------+
|                  |          |               |
+---v------+  +----v---+  +---v------+  +----v-----+
| Claude   |  | OCR    |  | News /   |  | Markt-   |
| API      |  | Tool   |  | Web-API  |  | daten    |
| (primaer)|  |(Azure) |  |(zwingend)|  | API(free)|
+---+------+  +--------+  +----------+  +----------+
    |
+---v----------------------------------------------+
|         PERSISTENZSCHICHT                        |
|                                                  |
|  snapshots | positions | cashflows | alerts      |
|                                                  |
|  PoC:  SQLite / Excel Online                     |
|  Prod: Azure Cosmos DB                           |
+--------------------------------------------------+
          |
+---------v--------------------------------------------+
|          ALERT-ENGINE                                |
|  Scheduler (Azure Timer Trigger)                     |
|  Push: E-Mail | Chat-Nachricht                       |
+------------------------------------------------------+
```

---

## 6. Fachliche Kernprozesse

### P1 — Depot-Intake
```
Input  -> PDF / CSV / Screenshot / Excel (DKB oder comdirect)
Schritt 1: Format erkennen (broker + format_type)
Schritt 2: OCR wenn PDF oder Screenshot
Schritt 3: LLM normalisiert -> Snapshot + Positionen-Array
Schritt 4: instrument_key vergeben (ISIN bevorzugt, sonst WKN)
Schritt 5: Themen-Klassifizierung durch LLM (mit Web-Recherche wenn noetig)
Schritt 6: Mischkurs berechnen falls entry_price nicht geliefert
Schritt 7: Qualitaetspruefung (Summen, Dubletten, fehlende Pflichtfelder)
Output -> Normalisierter Snapshot + Positionen
```

### P2 — Cashflow-Intake
```
Input  -> Excel / CSV (nur depot-relevante Transaktionen)
Schritt 1: LLM typisiert jeden Eintrag (buy/sell/dividend/fee/tax/...)
Schritt 2: instrument_key zuordnen (ISIN / WKN / Name matching)
Schritt 3: Unsichere Typisierungen markieren
Output -> Typisiertes Cashflow-Array
```

### P3 — Analyse-Report
```
Input  -> Aktueller Snapshot + optionale Vergleichsdaten
Struktur:
  1. Summary (Gesamtwert, Delta zum Vortag, Delta seit Kauf)
  2. Datenqualitaet (fehlende Felder, FX-Luecken, OCR-Unsicherheiten)
  3. Positionen (sortiert nach Gewicht / P&L)
  4. Aggregationen (Assetklasse, Region, Sektor, Themen, Broker)
  5. Treiber (Top-5 Beitragsleister + Live-News-Quellen)
  6. Risiko (Konzentration, Volatilitaet wenn Zeitreihe vorhanden)
  7. Ausblick & Watchlist-Events (quellenbasiert)
  8. Empfehlungen (qualitativ, mit Confidence-Level, klar von Fakten getrennt)
     -> auf Anfrage: konkrete Stueckzahlen / Betraege
```

### P4 — Historischer Vergleich
```
Input  -> 2 Snapshots (explizit oder letzter vs. aktuell)
Output -> Delta-Report:
  - Delta Gesamtwert (EUR + %)
  - Neue / weggefallene Positionen
  - Stueckzahl-Veraenderungen -> Kauf/Verkauf-Erkennung
    Primaer:  Cashflow-Matching
    Fallback: Stueckzahl-Vergleich
  - Staerkste Gewinner / Verlierer
```

### P5 — Alert-Check (Hintergrund)
```
Trigger -> Zeitbasiert (stuendlich) oder nach jedem neuen Snapshot
Prueft ->
  - Position fiel/stieg um X% seit letztem Snapshot
  - Depot-Gesamtwert unter/ueber Schwellwert
  - Maximaler Drawdown ueberschritten
  - News-Event zu gehaltener Position (via Web-API)
Output -> Alert-Log + Push-Benachrichtigung
```

---

## 7. Intent-Modell & Kommandosprache

| Kommando | Prozess | Speichert |
|---|---|---|
| `analysiere` | P3 | Nein |
| `analysiere und speichere` | P1 + P3 + P4 | Ja |
| `speichere` | P4 | Ja |
| `cashflows analysieren` | P2 | Nein |
| `cashflows speichern` | P2 | Ja |
| `vergleiche letzten Snapshot` | P4 | Nein |
| `zeige Historie` | Read | Nein |
| `empfehle konkret` | P3 erweitert | Nein |

---

## 8. Normalisierungs-Pipeline

| Input-Format | Verarbeitungsweg |
|---|---|
| DKB CSV | Direktparser, Felder 1:1 verfuegbar |
| comdirect PDF | OCR -> LLM-Strukturierung -> Felder mappen |
| Screenshot (DKB/comdirect) | OCR -> wie PDF |
| Excel Cashflow | Parser -> LLM-Typisierung |
| Freitext | LLM-Extraktion, best-effort mit Markierungen |

---

## 9. instrument_key — Vergabe-Logik

```
if ISIN vorhanden:
    instrument_key = ISIN                        (z.B. "IE00BKM4GZ66")
else if WKN vorhanden:
    instrument_key = "WKN-" + WKN               (z.B. "WKN-A111X9")
else:
    instrument_key = "NAME-" + slug(name_raw)   (markiert als unsicher)

Gleicher instrument_key bei DKB und comdirect fuer dasselbe Papier
-> ermoeglicht broker-uebergreifende Aggregation des Gesamtportfolios
```

---

## 10. Qualitaetsprinzipien

- Nichts erfinden — fehlende Felder als null + Markierung speichern
- Trennung: Rohdaten / Normalisiert / Berechnet / Interpretation / Empfehlung
- Empfehlungen mit Confidence-Level (hoch / mittel / niedrig) und Quelle
- LLM rechnet keine Zahlen — Berechnungen im Orchestrator
- FX-Luecken explizit markiert
- Timestamp Pflicht fuer jeden Snapshot
- Mehrere Snapshots pro Tag unterstuetzt (snapshot_id zeitbasiert)

---

## 11. Ausbaustufen

| Phase | Scope | Persistenz |
|---|---|---|
| PoC | CSV-Intake DKB, Snapshot speichern, Basis-Analyse, 1 Broker | SQLite / Excel |
| Beta | PDF-OCR, comdirect, Cashflow-Erkennung, Vergleich, News-API | Azure Cosmos DB |
| Prod | Alert-Engine, Marktdaten-API, Themen-KI, Screenshot-Pfad (Handy) | Cosmos DB + Azure Functions |

---

## 12. Offene Entscheidungen (naechste Session)

- Alert-Schwellwerte: konkrete Prozentwerte / EUR-Grenzen festlegen
- News-API: konkrete Auswahl (Bing News API, NewsAPI.org, ...)
- Marktdaten-API: Yahoo Finance vs. Alpha Vantage vs. andere freie Quelle
- OCR-Tool: Azure Form Recognizer vs. andere Loesung
- PoC-Persistenz: SQLite lokal oder Excel Online

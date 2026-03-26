# High-Level Design — Agentic Depot Analyse System
> Version: v0
> Datum: 2026-03-26
> Status: Entwurf — Basis für Reviewfragen vor v1/v2

---

## 1. Ziel & Abgrenzung

### Ziel
Ein persönliches, agentic Depot-Analyse-System, das:
- Depot-Inputs verschiedener Quellen (PDF, Screenshot, CSV) verarbeitet
- strukturierte Analysen, Berichte und Empfehlungen erzeugt
- Daten persistent speichert und historische Vergleiche ermöglicht
- aktiv warnt bei relevanten Ereignissen
- auf Live-Web-Recherche zurückgreift für Treiber- und Ausblick-Analysen

### Abgrenzung (explizites NEIN)
- kein Custom GPT / GPT Actions
- kein monolithischer Prompt
- kein LLM das Zahlen berechnet (LLM interpretiert, Code rechnet)
- keine unkontrollierte Web-Recherche (nur gezielt via Tool)
- keine Steuerberechnung (aktuell out of scope)
- keine Renditeversprechen oder Kaufempfehlungen mit Beträgen (nur qualitativ)
- kein Multi-User (aktuell: Einzelnutzer)

---

## 2. Fachlicher Scope

### 2.1 Eingabequellen

| Quelle | Format | Broker | Priorität |
|---|---|---|---|
| Depot-Übersicht PDF | PDF | comdirect | Primär |
| Depot-Screenshot | JPG/PNG | DKB, comdirect | Fallback / mobil |
| Depot-CSV-Export | CSV | DKB | Ergänzend |
| Cashflow-Liste | XLSX / CSV | DKB, comdirect | Depot-relevant |

Primärformat: **PDF**. Screenshots wenn kein PDF verfügbar (z.B. mobil). CSV wenn vorhanden als Ergänzung / Kreuzvalidierung.

### 2.2 Broker

- **DKB** (Depot-Nr. 510066848 aus v0-Beispieldaten)
- **comdirect**
- Beide Depots werden **zusammen** behandelt (konsolidierte Sicht)

### 2.3 Fachliche Kernfunktionen

#### A — Snapshot-Analyse
- Positionen extrahieren: ISIN, WKN, Name, Stückzahl, Kurs, Marktwert, unreal. G/V
- Aggregationen: Assetklasse, Region, Sektor, Themen
- Gewichtung und Beitragsrechnung
- Delta zum letzten Snapshot (wenn vorhanden)

#### B — Cashflow-Verarbeitung
- Scope: nur depot-relevante Transaktionen (Kauf, Verkauf, Dividende, Gebühr, Ein-/Auszahlung)
- Nicht: allgemeine Girokonto-Bewegungen
- Transaktionserkennung:
  - Primär: über Cashflow-Typ
  - Fallback: Stückzahl-Delta zwischen Snapshots (steigend = Zukauf, sinkend = Verkauf)

#### C — Risikokennzahlen
- Rolling Volatilität (5 / 15 / 30 / 60 Tage)
- Max Drawdown
- Datenquelle: externe freie API (z.B. Yahoo Finance) — nur wenn aufwandsneutral verfügbar
- Fallback: Berechnung aus eigenen Snapshot-Zeitreihen

#### D — Treiber-Analyse
- Top-5-Beitragsleister (positiv + negativ)
- Begründung via Live-Web-Recherche (News-API oder Web-Search-Tool)
- Quellenangabe Pflicht — keine unbelegten Interpretationen

#### E — Ausblick & Szenarien
- Nur quellenbasiert
- Watchlist-Events (Earnings, Makro-Termine)
- Keine Renditeversprechen

#### F — Empfehlungen
- Qualitativ: Diversifikation, Rebalancing, Risikokontrolle
- Konkret mit Beträgen/Stückzahlen nur auf explizite Anfrage
- Confidence-Level je Empfehlung

#### G — Aktives Alerting
- Push-Benachrichtigung bei definierten Ereignissen (z.B. Position -10%, Depot unter Schwellwert)
- Konfigurierbare Schwellwerte
- Kanal: noch offen (E-Mail, Push, Chat)

#### H — Einstandskurs / Mischkurs
- DKB-CSV: Einstiegskurs direkt geliefert
- comdirect-PDF: Kaufkurs geliefert
- Mischkurs bei mehreren Käufen: aus Cashflow-Historie berechnet, wenn nicht direkt geliefert

#### I — Themen-Klassifizierung
- LLM klassifiziert Positionen nach Thema (z.B. AI, Clean Energy, EM)
- Web-Recherche wenn nötig
- Ergebnis persistiert für spätere Snapshots

---

## 3. Datenmodell

### 3.1 snapshots
```
snapshot_id       | string  | PK, generiert (z.B. dkb_20260324_0628)
timestamp_berlin  | string  | YYYY-MM-DD HH:MM Europe/Berlin — Pflicht
broker            | string  | dkb | comdirect
depot_id          | string  | Depot-Nummer
portfolio_value_eur | number | Gesamtwert in EUR
notes             | string  | optional
```

### 3.2 positions
```
snapshot_id       | string  | FK -> snapshots
instrument_key    | string  | ISIN normalisiert, sonst WKN
isin              | string  |
wkn               | string  |
name_raw          | string  | Originalbezeichnung aus Quelle
asset_class       | string  | ETF | Aktie | Derivat | ...
region            | string  | z.B. EM | World | Japan
sector            | string  | z.B. Tech | Healthcare | Materials
quantity          | number  |
price             | number  | Bewertungskurs in EUR
market_value_eur  | number  |
unreal_pl_eur     | number  |
unreal_pl_pct     | number  |
entry_price       | number  | Einstandskurs (neu ggü. v0)
theme             | string  | LLM-klassifiziert (neu ggü. v0)
```

### 3.3 cashflows
```
date              | string  | Buchungsdatum
broker            | string  |
amount_eur        | number  |
type              | string  | buy|sell|dividend|fee|tax|deposit|withdrawal|unknown
instrument_key    | string  | optional (bei instrumentbezogenen Transaktionen)
memo_raw          | string  | Originaltext
```

### 3.4 alerts (neu — v0 hatte das nicht)
```
alert_id          | string  |
created_at        | string  |
type              | string  | threshold | delta | event
instrument_key    | string  | optional
condition         | string  | z.B. "price_delta_pct < -10"
status            | string  | active | triggered | dismissed
```

---

## 4. Systemarchitektur

```
[ Web UI / Chat UI ]           <- Next.js, kein Logik
        |
        v
[ Orchestrator API ]           <- KERN (Azure Functions / Node.js)
        |
   +-----------+---------------+------------------+
   |           |               |                  |
   v           v               v                  v
[ LLM ]   [ Tools ]      [ Persistenz ]     [ Alerting ]
Claude     - OCR/Parse     Excel Online        Azure Logic Apps
           - Web-Search    (PoC -> Azure       / Functions
           - Marktdaten    Table Storage)
           - Cashflow-
             Parser
```

### Komponenten

| Komponente | Technologie | Zweck |
|---|---|---|
| Web/Chat UI | Next.js | Eingabe, Report-Darstellung |
| Orchestrator | Azure Functions (Node.js) | Intent, Workflow, Prompt, Tool-Routing |
| LLM | Claude API (primär) | Extraktion, Normalisierung, Analyse, Bewertung |
| OCR/Parse | Azure Document Intelligence oder pdf-parse | PDF/Screenshot -> strukturierte Daten |
| Web-Search | Bing Search API oder Tavily | Live-Treiber-Recherche |
| Marktdaten | Yahoo Finance API (kostenlos) oder ähnl. | Zeitreihen für Risikorechnung |
| Persistenz | Excel Online (PoC) -> Azure Table Storage | Snapshots, Positionen, Cashflows |
| Alerting | Azure Logic Apps oder Timer-Function | Aktive Schwellwert-Benachrichtigung |
| Secrets | Azure Key Vault | API Keys, Credentials |
| Versionierung | GitHub | Prompts, Workflows, Constraints, Code |

---

## 5. Orchestrator-Logik (Intent-Modell)

### Intent-Typen

| Intent | Trigger-Beispiele | Workflow |
|---|---|---|
| `analyse` | "analysiere", "was ist mein Stand" | Extraktion -> Normalisierung -> Report |
| `analyse_and_save` | "analysiere und speichere" | wie analyse + Persistenz |
| `save` | "speichere" | Persistenz (letztes Analyse-Ergebnis) |
| `compare` | "vergleiche mit letztem Snapshot" | get_snapshot_bundle -> Delta |
| `history` | "zeige Historie" | get_history |
| `cashflow` | Cashflow-Datei hochgeladen | Cashflow-Parser -> optional speichern |
| `alert_config` | "warnen wenn X unter Y" | Alert-Konfiguration speichern |

### Routing-Prinzip
- **Standardverhalten**: analysieren, nicht speichern, kein Action-Call
- **Speichern**: nur bei explizitem Befehl
- **Quelle bestimmt Workflow**: PDF/Screenshot -> Snapshot-Workflow; Cashflow-Datei -> Cashflow-Workflow

---

## 6. Externe Abhängigkeiten (offen / zu klären)

| Abhängigkeit | Kandidat | Status |
|---|---|---|
| OCR / PDF-Parse | Azure Document Intelligence, pdf-parse, Tesseract | offen |
| Web-Search | Bing Search API, Tavily, SerpAPI | offen |
| Marktdaten | Yahoo Finance (yfinance), Alpha Vantage | offen |
| Auth (Chat UI) | Static API Key (PoC) -> Azure AD B2C | Static Key für PoC |
| Alerting-Kanal | E-Mail, Push, Chat | offen |

---

## 7. Migrationspfad von v0

| v0 | Ziel-System |
|---|---|
| ChatGPT Custom GPT | Claude API + eigener Orchestrator |
| Google Sheets | Excel Online (PoC) -> Azure Table Storage |
| Google Apps Script | Azure Functions (Node.js) |
| OpenAPI YAML Schema | Orchestrator-interne Tool-Definitionen |
| GPT Actions | Claude Tool Use |

Fachliche Logik (Datenmodell, Workflows, Feldnamen) wird **direkt übernommen** — das war in v0 bereits durchdacht.

---

## 8. Nicht-funktionale Anforderungen

| Anforderung | Ziel |
|---|---|
| Snapshot-Frequenz | mehrmals täglich — Timestamp-Präzision auf Minute |
| Einzelnutzer | kein Multi-Tenancy erforderlich (aktuell) |
| Auditierbarkeit | alle Speicher-Aktionen explizit, keine Auto-Saves |
| Evolvierbarkeit | LLM austauschbar, Storage migrierbar |
| Kosten | Budget-Guard: Azure Cost Alert, Anthropic Spending Limit |
| Datenschutz | keine IBAN, PIN, Login-Daten im System |

---

## 9. Offene Entscheidungen (Input für Reviewfragen)

1. OCR-Technologie: Azure Document Intelligence (kostenpflichtig) vs. Open Source?
2. Web-Search-API: Bing vs. Tavily vs. andere?
3. Alerting-Kanal: Wie sollen Alerts zugestellt werden?
4. Marktdaten-API: Yahoo Finance ausreichend, oder Fallback nötig?
5. Excel Online vs. direkter Einstieg mit Azure Table Storage?
6. Auth-Strategie Chat UI: Wann wird Static Key zu eng?
7. Deployment: Azure Functions Consumption Plan vs. Premium?
8. instrument_key-Kollisionen: Was passiert wenn ISIN fehlt und WKN mehrdeutig?
9. Historische Daten: Wie weit zurück soll die Analyse reichen können?
10. Konsolidierung DKB + comdirect: Wie werden Positionen die in beiden Depots existieren behandelt?

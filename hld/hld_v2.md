# High-Level Design — Agentic Depot Analyse System
> Version: v2
> Datum: 2026-03-26
> Status: Reviewed — Basis für Implementierung Block 2+

---

## 1. Ziel & Abgrenzung

### Ziel
Persönliches, agentic Depot-Analyse-System für einen Einzelnutzer mit zwei Depots (DKB, comdirect):
- Depot-Inputs manuell hochladen (PDF, Screenshot, CSV) → strukturierte Analyse
- Marktpreise automatisch abrufen (06:00 + 20:00 Uhr) → Mini-Analyse + Alerting
- Historische Vergleiche, Treiber-Analyse mit Live-Web-Recherche
- Aktives E-Mail-Alerting bei Schwellwert-Ereignissen
- Betrieb: lokal auf PC, Persistenz in Azure Table Storage (Cloud)

### Ziele nach Priorität
1. Korrekte Analyse ohne Datenfehler
2. Stabile, einfache Bedienbarkeit (PC + Handy)
3. Kosten ≤ 3 EUR/Monat im Dauerbetrieb
4. Evolvierbarkeit (Storage, Modell, Broker austauschbar)

### Explizites NEIN
- kein Custom GPT, kein GPT Actions
- kein LLM das Zahlen berechnet (LLM interpretiert, Code rechnet)
- keine unkontrollierte Web-Recherche
- keine Steuerberechnung
- keine Renditeversprechen, keine konkreten Kauf-/Verkaufsmengen (Standard)
- kein Multi-User
- kein Always-on Server (Start < 1 Minute)

---

## 2. Fachlicher Scope

### 2.1 Eingabequellen

| Quelle | Format | Broker | Modus |
|---|---|---|---|
| Depot-Übersicht PDF | PDF | comdirect | Primär, manuell |
| Depot-Screenshot | JPG/PNG | DKB, comdirect | Fallback / mobil |
| Depot-CSV-Export | CSV | DKB | Ergänzend / Kreuzvalidierung |
| Cashflow-Liste | XLSX / CSV | DKB, comdirect | Manuell |
| Marktpreise | JSON via API | alle Positionen | Automatisch 06:00 + 20:00 |

**OCR**: Claude liest PDFs und Screenshots nativ — kein separater OCR-Service.

### 2.2 Depots & Konsolidierung

- **DKB** + **comdirect** werden **konsolidiert** behandelt
- Gleiche ISIN in beiden Depots → eine konsolidierte Position (Summe Stückzahl, Mischkurs über beide Depots)
- Broker-Herkunft bleibt als Metadatum erhalten (`broker_source`)
- Mischkurs: berechnet über alle Käufe beider Depots

### 2.3 Fachliche Kernfunktionen

#### A — Manuelle Depot-Analyse (auf Anfrage)
- Claude liest PDF / Screenshot / CSV direkt
- Positionen extrahieren: ISIN, WKN, Name, Stückzahl, Kurs, Marktwert, unreal. G/V, Einstandskurs
- Normalisierung: ISIN > WKN > Name als `instrument_key`
- Plausibilitätsprüfung: Summen, Dubletten, fehlende ISINs → Incidents
- Aggregation: Assetklasse, Region, Sektor, Thema (LLM-klassifiziert)
- Delta zum letzten Snapshot (auf Anfrage)
- Speichern: **nur bei explizitem Befehl**

#### B — Automatischer Preis-Update (06:00 + 20:00 via GitHub Actions)
- Lädt Marktpreise für alle Positionen des letzten Depot-Snapshots
- Quelle: Yahoo Finance API (kostenlos) → Fallback Alpha Vantage (25 Req/Tag frei)
- Schreibt `price_update`-Datensatz in Azure Table Storage
- Mini-Analyse via Claude Haiku: Auffälligkeiten, Schwellwert-Prüfung
- Löst E-Mail-Alert aus wenn Bedingung erfüllt

#### C — Cashflow-Verarbeitung
- Scope: alle depot-relevanten Transaktionen (Kauf, Verkauf, Dividende, Gebühr, Steuer, Ein-/Auszahlung)
- Nicht: allgemeine Girokontobewegungen
- Transaktionserkennung: primär über Cashflow-Typ, Fallback über Stückzahl-Delta
- Mischkurs-Berechnung aus Cashflow-Historie

#### D — Treiber-Analyse (auf Anfrage)
- Top-5-Beitragsleister positiv + negativ
- Live-Web-Recherche via Tavily (~3–4× täglich, auf Anfrage)
- Claude Haiku für Search-Summary, Quellenangabe Pflicht
- Keine unbelegten Interpretationen

#### E — Risikokennzahlen (auf Anfrage)
- Rolling Volatilität: 5 / 15 / 30 / 60 Tage
- Max Drawdown
- Datenquelle: Yahoo Finance Zeitreihen, Fallback Alpha Vantage
- Berechnung im Code, nicht durch LLM

#### F — Empfehlungen (auf Anfrage)
- Standard: qualitativ (Diversifikation, Rebalancing, Risikokontrolle)
- Konkret mit Beträgen: nur auf explizite Anfrage
- Confidence-Level je Empfehlung
- Keine Renditeversprechen

#### G — Aktives E-Mail-Alerting
- Konfigurierbare Schwellwerte (z.B. Position −10%, Depot unter X EUR)
- Automatisch geprüft bei 06:00/20:00 Preis-Update
- Versand via Azure Communication Services (kostenlos bis 100 E-Mails/Tag)
- Nur eine E-Mail pro Ereignis (kein Spam)

#### H — Incidents
- Auslöser: fehlende ISIN, Extraktionsfehler, nicht zuordenbare Positionen
- System versucht Auto-Auflösung via Web-Recherche (ISIN-Lookup)
- Nutzer bestätigt, korrigiert oder schließt Incident manuell
- Incidents blockieren nicht den Rest des Speichervorgangs (partial save)

#### I — Historischer Vergleich (auf Anfrage)
- "letzter Snapshot", "vor 30 Tagen", "Jahresanfang", "bestes/schlechtestes Datum"
- Basis: alle gespeicherten Snapshots + price_updates in Azure Table Storage

---

## 3. Datenmodell

### snapshots
```
PartitionKey      = broker (dkb | comdirect | consolidated)
RowKey            = snapshot_id (z.B. consolidated_20260324_0628)
timestamp_berlin  : string   YYYY-MM-DD HH:MM — Pflicht
depot_id          : string
portfolio_value_eur: number
notes             : string
source            : string   manual | auto
```

### positions
```
PartitionKey      = snapshot_id
RowKey            = instrument_key
isin              : string
wkn               : string
name_raw          : string
broker_source     : string   dkb | comdirect | consolidated
asset_class       : string
region            : string
sector            : string
theme             : string   LLM-klassifiziert
quantity          : number   konsolidiert über beide Depots
price             : number   Bewertungskurs EUR
market_value_eur  : number
unreal_pl_eur     : number
unreal_pl_pct     : number
entry_price       : number   Mischkurs konsolidiert
```

### cashflows
```
PartitionKey      = broker
RowKey            = date + "_" + instrument_key + "_" + type
date              : string
amount_eur        : number
type              : string   buy|sell|dividend|fee|tax|deposit|withdrawal|unknown
instrument_key    : string   optional
memo_raw          : string
```

### price_updates
```
PartitionKey      = instrument_key
RowKey            = timestamp_berlin
price             : number
source            : string   yahoo | alphavantage
```

### alerts_config
```
PartitionKey      = "alerts"
RowKey            = alert_id
instrument_key    : string   optional (leer = Depot-gesamt)
condition         : string   z.B. "price_delta_pct < -10"
active            : boolean
last_triggered    : string
```

### incidents
```
PartitionKey      = "incidents"
RowKey            = incident_id
created_at        : string
snapshot_id       : string
type              : string   missing_isin | extraction_error | unresolved_position
name_raw          : string
details           : string
status            : string   open | auto_resolved | closed_by_user | closed_by_system
resolution        : string   optional
```

---

## 4. Systemarchitektur

```
┌─────────────────────────────────────────────────────┐
│                  LOKALE APP (PC)                     │
│                                                      │
│  [ CLI / einfache Web-UI (localhost) ]               │
│           │                                          │
│           ▼                                          │
│  [ Orchestrator (Node.js) ]                          │
│    Intent → Workflow → Tool-Routing                  │
│           │                                          │
│    ┌──────┼──────────┬──────────────┐               │
│    ▼      ▼          ▼              ▼               │
│  [Claude] [Tavily] [Yahoo/AV]  [Azure Storage]      │
│  Haiku/   Web-     Marktdaten  Table Storage         │
│  Sonnet   Search                                     │
└─────────────────────────────────────────────────────┘
           │ Lese/Schreibe
           ▼
┌─────────────────────────┐
│  Azure Table Storage    │  ← Cloud, immer verfügbar
│  snapshots              │
│  positions              │
│  cashflows              │
│  price_updates          │
│  alerts_config          │
│  incidents              │
└─────────────────────────┘
           ▲
           │ Schreibe price_updates, trigger alerts
┌─────────────────────────┐
│  GitHub Actions (Cron)  │  ← 06:00 + 20:00 Uhr
│  - Marktpreise abrufen  │     kostenlos, PC muss
│  - Mini-Analyse (Haiku) │     nicht laufen
│  - Alert-Prüfung        │
│  - E-Mail via Azure     │
└─────────────────────────┘
```

### Komponenten-Entscheidungen

| Komponente | Technologie | Begründung |
|---|---|---|
| Lokale App | Node.js (kein Framework) | Einfach, `npm start`, < 1 Min |
| LLM Routine | Claude Haiku 4.5 | 10× günstiger, reicht für Updates |
| LLM Analyse | Claude Sonnet 4.6 | Nur auf explizite Anfrage |
| PDF/Screenshot | Claude nativ (kein OCR) | Kostenlos, kein Extra-Service |
| Web-Search | Tavily | LLM-optimiert, ~€0,55/Monat |
| Marktdaten | Yahoo Finance → Alpha Vantage | Kostenlos, Fallback |
| Persistenz | Azure Table Storage | ~€0,01/Monat, bereits vorhanden |
| Cron | GitHub Actions | Kostenlos, PC-unabhängig |
| E-Mail Alert | Azure Communication Services | Kostenlos bis 100/Tag |
| Secrets | .env lokal + GitHub Secrets | Einfach, sicher |
| Versionierung | GitHub | Prompts, Workflows, Code |

---

## 5. LLM-Modell-Strategie (Kostenkontrolle)

| Aufgabe | Modell | Grund |
|---|---|---|
| Automatischer Preis-Update Mini-Analyse | Claude Haiku 4.5 | ~€0,001/Aufruf |
| Web-Search Summary | Claude Haiku 4.5 | ~€0,005/Aufruf |
| Cashflow-Parsing | Claude Haiku 4.5 | Strukturierte Aufgabe |
| Vollständige Depot-Analyse | Claude Sonnet 4.6 | Nur auf explizite Anfrage |
| Treiber-Analyse mit Web-Recherche | Claude Sonnet 4.6 | Nur auf explizite Anfrage |
| Incident-Auto-Auflösung | Claude Haiku 4.5 | ISIN-Lookup einfach |

### Kostenmodell (Monat, Dauerbetrieb)

| Posten | Frequenz | Kosten |
|---|---|---|
| Haiku Auto-Updates | 2×/Tag × 30 | ~€0,10 |
| Haiku Web-Search Summary | 4×/Tag × 30 | ~€0,30 |
| Sonnet Vollanalyse | ~5×/Woche | ~€1,50 |
| Tavily Search | 4×/Tag × 30 | ~€0,55 |
| Azure Table Storage | — | ~€0,01 |
| Azure Email / GitHub | — | €0,00 |
| **Gesamt** | | **~€2,50/Monat** |

---

## 6. Orchestrator Intent-Modell

| Intent | Trigger-Beispiele | Modell | Workflow |
|---|---|---|---|
| `analyse` | "analysiere", "was ist mein Stand" | Sonnet | Extraktion → Normalisierung → Report |
| `analyse_and_save` | "analysiere und speichere" | Sonnet | + Persistenz |
| `save` | "speichere" | — | Letztes Ergebnis speichern |
| `compare` | "vergleiche mit letztem Snapshot" | Sonnet | get_bundle → Delta |
| `history` | "zeige Historie", "vor 30 Tagen" | Haiku | Storage-Query |
| `cashflow` | Cashflow-Datei | Haiku | Parser → optional speichern |
| `treiber` | "warum hat X verloren" | Sonnet + Tavily | Web-Search → Summary |
| `risiko` | "zeige Volatilität" | Haiku | Berechnung auf Zeitreihen |
| `alert_config` | "warnen wenn X unter Y" | Haiku | Config speichern |
| `price_update` | Cron 06:00/20:00 | Haiku | API → Storage → Alert-Check |

### Routing-Prinzip
- **Standard**: analysieren, nicht speichern
- **Speichern**: nur bei explizitem Befehl
- **Incidents**: nie blockieren, immer partial save + Incident-Eintrag

---

## 7. Migrationspfad von v0

| v0 (Custom GPT) | v2 (Agentic System) | Aufwand |
|---|---|---|
| ChatGPT Custom GPT "MoMo" | Claude API + lokaler Orchestrator | mittel |
| Google Sheets | Azure Table Storage | gering |
| Google Apps Script | GitHub Actions + lokaler Node.js | gering |
| OpenAPI YAML Schema | Claude Tool Use (intern) | gering |
| GPT Actions | Orchestrator Tool-Routing | mittel |
| Initiale Daten (v0 CSV/PDF) | Import-Skript → Azure Table Storage | einmalig |

**Fachliche Logik** (Datenmodell, Feldnamen, Workflows) direkt übernommen und erweitert.
**Initiale historische Daten** aus `v0/input/` werden via Import-Skript übertragen.

---

## 8. Nicht-funktionale Anforderungen

| Anforderung | Ziel | Entschieden |
|---|---|---|
| Startup-Zeit | < 1 Minute | ✓ lokale Node.js App |
| Plattform | PC + Handy (Browser/Chat) | ✓ localhost Web-UI |
| Always-on | Nicht erforderlich | ✓ Cron via GitHub Actions |
| Kosten | ≤ 3 EUR/Monat | ✓ ~2,50 EUR erwartet |
| Auditierbarkeit | Nur explizites Speichern | ✓ |
| Datenschutz | Keine IBAN, PIN, Login-Daten | ✓ |
| Evolvierbarkeit | LLM, Storage, Broker austauschbar | ✓ |
| Snapshot-Frequenz | Mehrmals täglich | ✓ 2× auto + manuell |

---

## 9. Offene Punkte (für Block 2)

| # | Thema | Prio |
|---|---|---|
| O1 | Tavily vs. Bing Search API — finaler Test mit realen Abfragen | hoch |
| O2 | Yahoo Finance Zuverlässigkeit für ETFs prüfen (ISINs vs. Ticker) | hoch |
| O3 | Alpha Vantage Rate Limit: 25 Req/Tag für 18+ Positionen ausreichend? | mittel |
| O4 | Handy-Workflow: Chat-Interface im Browser (localhost) erreichbar? Oder separates Deployment? | mittel |
| O5 | Import-Skript für v0-Initialdaten definieren | mittel |
| O6 | Alert E-Mail Template definieren | niedrig |
| O7 | Incidents: ISIN-Lookup via welchem Dienst (OpenFIGI, ISIN.org)? | niedrig |

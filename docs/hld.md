# High-Level Design — Agentic Depot Analyse System
> Version: v3 (final vor Implementierung)
> Datum: 2026-03-26
> Basis: v2 (Architektur) + v0.5 (fachliche Details)

---

## 1. Ziel & Abgrenzung

Persönliches, agentic Depot-Analyse-System (Einzelnutzer) für DKB + comdirect:
- Manuelle Depot-Inputs (PDF, Screenshot, CSV) → strukturierte Analyse + Speichern
- Automatischer Marktpreis-Abruf 06:00 + 20:00 Uhr (GitHub Actions, kein LLM)
- Live-Web-Recherche für Treiber-Analysen (Tavily)
- Aktives E-Mail-Alerting bei Schwellwert-Ereignissen
- Lokale Node.js App, Persistenz in Azure Table Storage

### Explizites NEIN
- Kein Multi-User, keine Steuerberechnung, keine Orderausführung
- Kein Broker-API-Scraping (Depot-Daten immer manuell)
- Kein LLM das Zahlen berechnet (LLM interpretiert, Code rechnet)
- Keine automatischen Speicherungen (nur auf expliziten Befehl)
- Kein Always-on Server (Startup < 1 Minute)

---

## 2. Eingabe & Broker

| Broker | Primärformat | Weitere Formate | Besonderheit |
|---|---|---|---|
| DKB | CSV-Export | Screenshot (Handy), PDF | Einstiegskurs direkt im CSV |
| comdirect | PDF-Export | Screenshot, CSV | Kaufkurs im PDF |

**Grundprinzip:** System akzeptiert was verfügbar ist. CSV bevorzugt (kein OCR-Risiko), PDF Standard, Screenshot Fallback vom Handy.

**OCR-Strategie:** Claude liest PDF und Screenshots nativ — kein separater OCR-Service.

---

## 3. Datenmodell

### 3.1 snapshots
```
PartitionKey        = broker  (dkb | comdirect | consolidated)
RowKey              = snapshot_id  (YYYYMMDD-HHMM-{broker}-{depot_id}, deterministisch)
timestamp_berlin    : string   YYYY-MM-DD HH:MM — Pflicht
depot_id            : string   Depotnummer
portfolio_value_eur : number   Gesamtwert laut Broker-Dokument
source_format       : string   csv | pdf | screenshot | xlsx
notes               : string
```

### 3.2 positions
```
PartitionKey        = snapshot_id
RowKey              = instrument_key
isin                : string
wkn                 : string
name_raw            : string   Originalbezeichnung aus Quelle
broker_source       : string   dkb | comdirect | consolidated
asset_class         : string   ETF | Aktie | Anleihe | Derivat | Rohstoff
region              : string   DE | EU | US | EM | Global | Asien | ...
sector              : string   Technologie | Gesundheit | Energie | ...
theme               : string   LLM-vergeben (z.B. "Kern-Wachstum", "EM Tech")
quantity            : number   konsolidiert über beide Depots
price               : number   Aktueller Kurs
entry_price         : number   Einstandskurs / Mischkurs
purchase_value_eur  : number   quantity × entry_price
market_value_eur    : number
unreal_pl_eur       : number
unreal_pl_pct       : number
currency            : string   EUR | USD | ... (FX-Markierung wenn nicht EUR)
```

### 3.3 cashflows
*(nur depot-relevante Transaktionen)*
```
PartitionKey        = broker
RowKey              = date + "_" + instrument_key + "_" + type + "_" + seq
date                : string
broker              : string
amount_eur          : number
type                : string   buy | sell | dividend | fee | tax | deposit | withdrawal | unknown
instrument_key      : string   leer bei reinen Ein-/Auszahlungen
quantity            : number   optional — bei Kauf/Verkauf
price               : number   optional — Ausführungskurs
memo_raw            : string
```

### 3.4 price_updates
*(automatische Marktpreis-Updates via GitHub Actions)*
```
PartitionKey        = instrument_key
RowKey              = timestamp_berlin
price               : number
change_pct_1d       : number   Tagesveränderung %
source              : string   yahoo | alphavantage
```

### 3.5 alerts_config
*(Konfiguration: was soll getriggert werden)*
```
PartitionKey        = "config"
RowKey              = alert_id
instrument_key      : string   leer = Depot-gesamt
condition           : string   z.B. "price_delta_pct < -10" | "portfolio_value_eur < 40000"
alert_type          : string   threshold_breach | drawdown | snapshot_delta
severity            : string   info | warn | critical
active              : boolean
```

### 3.6 alert_log
*(History: was wurde wann getriggert)*
```
PartitionKey        = "log"
RowKey              = timestamp_berlin + "_" + alert_id
alert_id            : string   FK → alerts_config
timestamp_berlin    : string
alert_type          : string   threshold_breach | drawdown | news_event | snapshot_delta
instrument_key      : string   optional
message             : string
severity            : string   info | warn | critical
acknowledged        : boolean
```

### 3.7 incidents
*(Ungeklärte Positionen, Extraktionsfehler)*
```
PartitionKey        = "incidents"
RowKey              = incident_id
created_at          : string
snapshot_id         : string
type                : string   missing_isin | extraction_error | unresolved_position
name_raw            : string
details             : string
status              : string   open | auto_resolved | closed_by_user | closed_by_system
resolution          : string   optional
```

---

## 4. instrument_key — Vergabelogik

```
if ISIN vorhanden:
    instrument_key = ISIN                          z.B. "IE00BKM4GZ66"
else if WKN vorhanden:
    instrument_key = "WKN-" + WKN                 z.B. "WKN-A111X9"
else:
    instrument_key = "NAME-" + slug(name_raw)      markiert als unsicher → Incident
```

Gleicher `instrument_key` für DKB und comdirect beim selben Instrument → ermöglicht broker-übergreifende Konsolidierung.

---

## 5. Systemarchitektur

```
┌──────────────────────────────────────────────────────┐
│                  LOKALE APP (PC)                      │
│                                                       │
│  [ Web-UI localhost:3000 ]  ←  Browser PC + Handy    │
│           │                                           │
│           ▼                                           │
│  [ Orchestrator (Node.js) ]                           │
│    Intent-Erkennung → Workflow-Routing                │
│           │                                           │
│    ┌──────┼──────────┬──────────────┐                │
│    ▼      ▼          ▼              ▼                │
│  [Claude] [Tavily] [Yahoo/AV]  [Azure Tables]        │
│  Haiku/   Web-     Marktdaten  Storage-Client        │
│  Sonnet   Search                                      │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Azure Table Storage │  Cloud, immer verfügbar
              │  7 Tabellen (s.o.)   │
              └──────────────────────┘
                         ▲
              ┌──────────────────────┐
              │  GitHub Actions Cron │  06:00 + 20:00 Uhr
              │  - Marktpreise holen │  PC muss nicht laufen
              │  - Alert-Check       │
              │  - E-Mail via Azure  │
              └──────────────────────┘
```

### Technologie-Entscheidungen

| Komponente | Technologie | Kosten/Monat |
|---|---|---|
| Lokale App | Node.js | €0 |
| LLM Routine | Claude Haiku 4.5 | ~€0,10 |
| LLM Analyse | Claude Sonnet 4.6 (nur auf Anfrage) | ~€1,50 |
| Web-Search | Tavily | ~€0,55 |
| Marktdaten | Yahoo Finance → Alpha Vantage | €0 |
| Persistenz | Azure Table Storage | ~€0,01 |
| Cron | GitHub Actions | €0 |
| E-Mail | Azure Communication Services | €0 |
| **Gesamt** | | **~€2,20** |

---

## 6. LLM-Modellstrategie

| Aufgabe | Modell |
|---|---|
| Preis-Update Mini-Analyse | Haiku 4.5 |
| Web-Search Summary | Haiku 4.5 |
| Cashflow-Typisierung | Haiku 4.5 |
| Incident Auto-Auflösung | Haiku 4.5 |
| Depot-Vollanalyse | Sonnet 4.6 |
| Treiber-Analyse mit Web-Recherche | Sonnet 4.6 |
| PDF/Screenshot-Extraktion | Sonnet 4.6 |

**Regel:** Haiku wenn strukturierte Aufgabe, Sonnet wenn Interpretation + Qualität zählt.

---

## 7. Normalisierungspipeline

| Input-Format | Verarbeitungsweg |
|---|---|
| DKB CSV | Direktparser (kein LLM nötig, Felder 1:1) |
| comdirect PDF | Claude Sonnet nativ → JSON-Extraktion |
| Screenshot (DKB/cmd) | Claude Sonnet nativ → wie PDF |
| Excel/CSV Cashflow | Direktparser → Haiku Typisierung |
| Freitext | Sonnet best-effort + Markierungen |

---

## 8. Fachliche Kernprozesse

### P1 — Depot-Intake (manuell)
```
1. Format erkennen (broker + source_format)
2. Claude extrahiert → Snapshot + Positionen-Array (JSON)
3. instrument_key vergeben (ISIN → WKN- → NAME-)
4. Themen-Klassifizierung (Haiku, mit Web-Recherche wenn nötig)
5. Mischkurs berechnen falls entry_price nicht geliefert
6. Plausibilitätsprüfung (Summen, Dubletten, Pflichtfelder)
   → fehlende/unsichere Felder → Incident erstellen
7. Output: normalisierter Snapshot + Positionen
```

### P2 — Cashflow-Intake (manuell)
```
1. Haiku typisiert jeden Eintrag (buy/sell/dividend/fee/tax/...)
2. instrument_key zuordnen (ISIN / WKN / Name-Matching)
3. Unsichere Typisierungen markieren
4. Output: typisiertes Cashflow-Array
```

### P3 — Analyse-Report
```
Struktur:
  1. Summary (Gesamtwert, Delta zum letzten Snapshot, Delta seit Kauf)
  2. Datenqualität (fehlende Felder, FX-Lücken, OCR-Unsicherheiten)
  3. Positionen (sortiert nach Gewicht / P&L)
  4. Aggregationen (Assetklasse, Region, Sektor, Themen, Broker)
  5. Treiber (Top-5 Beitragsleister + Live-Recherche-Quellen)
  6. Risiko (Konzentration, Volatilität wenn Zeitreihe vorhanden)
  7. Ausblick & Watchlist-Events (quellenbasiert)
  8. Empfehlungen (qualitativ, Confidence-Level, von Fakten getrennt)
     → auf Anfrage: konkrete Stückzahlen / Beträge
```

### P4 — Historischer Vergleich (auf Anfrage)
```
Input:  2 Snapshots (explizit oder letzter vs. aktuell)
Output: - Delta Gesamtwert (EUR + %)
        - Neue / weggefallene Positionen
        - Stückzahl-Veränderungen → Kauf/Verkauf-Erkennung
          Primär: Cashflow-Matching
          Fallback: Stückzahl-Vergleich
        - Stärkste Gewinner / Verlierer
```

### P5 — Automatischer Preis-Update (GitHub Actions)
```
Trigger: Cron 06:00 + 20:00 Europe/Berlin
1. Positionen des letzten Snapshots laden
2. Marktpreise abrufen (Yahoo Finance → Alpha Vantage)
3. price_updates schreiben
4. Alert-Bedingungen prüfen (regelbasiert, kein LLM)
5. Bei Treffer: alert_log schreiben + E-Mail senden
```

### P6 — Incidents-Workflow
```
Erstellt bei: fehlender ISIN, Extraktionsfehler, nicht zuordenbaren Positionen
Auto-Auflösung: Haiku + Web-Lookup (ISIN-Suche nach Name/WKN)
Manuell: Nutzer bestätigt oder schließt über UI
Grundregel: Incidents blockieren nicht den Speichervorgang (partial save)
```

---

## 9. Intent-Modell

| Intent | Beispiel-Kommando | Modell | Speichert |
|---|---|---|---|
| `analyse` | "analysiere" | Sonnet | Nein |
| `analyse_and_save` | "analysiere und speichere" | Sonnet | Ja |
| `save` | "speichere" | — | Ja |
| `cashflow` | Cashflow-Datei hochladen | Haiku | Nein / auf Anfrage |
| `compare` | "vergleiche mit letztem Snapshot" | Sonnet | Nein |
| `history` | "zeige Historie", "vor 30 Tagen" | Haiku | Nein |
| `treiber` | "warum hat X verloren" | Sonnet + Tavily | Nein |
| `risiko` | "zeige Volatilität" | Haiku | Nein |
| `alert_config` | "warnen wenn X unter Y%" | Haiku | Ja |
| `price_update` | Cron automatisch | Haiku | Ja |

---

## 10. Qualitätsprinzipien

1. **Nichts erfinden** — fehlende Felder als `null` speichern + Incident
2. **Schichttrennung:** Rohdaten → Normalisiert → Berechnet → Interpretation → Empfehlung
3. **LLM rechnet keine Zahlen** — alle Berechnungen im Orchestrator (Code)
4. **Empfehlungen** mit Confidence-Level (hoch/mittel/niedrig) und Quellenangabe
5. **FX-Lücken** explizit markiert (`currency` ≠ EUR → Warnung)
6. **Timestamp Pflicht** für jeden Snapshot
7. **Mehrere Snapshots/Tag** unterstützt (snapshot_id zeitbasiert, deterministisch)
8. **Partial Save** — Incidents blockieren nicht den Rest des Speichervorgangs

---

## 11. Ausbaustufen

| Phase | Scope | Storage |
|---|---|---|
| **PoC** (Block 2–3) | DKB CSV, Snapshot speichern, Basis-Analyse, 1 Broker | Azure Table Storage |
| **Beta** (Block 4) | comdirect PDF, Cashflow, Vergleich, Treiber, Cron, Alerts | Azure Table Storage |
| **Prod** (Block 5) | Web-UI, Risikokennzahlen, Incidents-UI, Screenshot-Pfad | Azure Table Storage |

---

## 12. Offene Punkte (Block 2+)

| # | Thema | Priorität |
|---|---|---|
| O1 | Anthropic API Key beschaffen (console.anthropic.com) | Sofort |
| O2 | Azure Table Storage Account einrichten | Sofort |
| O3 | Tavily API Key beschaffen (tavily.com) | Block 4 |
| O4 | Yahoo Finance ETF-Abdeckung testen (ISIN vs. Ticker-Problem) | Block 4 |
| O5 | Alpha Vantage Rate Limit prüfen (25 Req/Tag für 18+ Positionen) | Block 4 |
| O6 | Alert-Schwellwerte definieren (konkrete % / EUR-Werte) | Block 4 |
| O7 | E-Mail-Adresse für Alerts konfigurieren | Block 4 |
| O8 | Handy-Zugang: localhost via WLAN oder separates Deployment | Block 5 |
| O9 | ISIN-Lookup-Dienst für Incident-Auflösung (OpenFIGI?) | Block 5 |
| O10 | v0-Daten-Import: welche historischen Daten übernehmen | Block 2.3 |

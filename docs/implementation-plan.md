# Implementierungsplan — Agentic Depot Analyse System
> Pfad 3: Eigene lokale Node.js App
> Referenz: hld/hld_v2.md
> Stand: 2026-03-26

---

## Block 2 — Fundament (Voraussetzung für alles)

### 2.1 Projektstruktur & Dependencies
- `package.json` mit Abhängigkeiten (Anthropic SDK, Azure Table Storage SDK, Tavily, Express)
- Ordnerstruktur: `src/`, `src/storage/`, `src/llm/`, `src/tools/`, `src/workflows/`, `ui/`
- `.env.example` mit allen nötigen Keys
- `.gitignore` (`.env`, `node_modules/`)

### 2.2 Azure Table Storage — Datenschicht
- Client-Wrapper für alle 6 Tabellen
- CRUD-Operationen: upsert, query, list
- Tabellen anlegen wenn nicht vorhanden (idempotent)

### 2.3 v0-Daten-Import
- Einmal-Skript: v0/input/ CSV + ggf. historische Daten → Azure Table Storage
- Mapping: v0-Feldnamen → v2-Datenmodell

---

## Block 3 — Kern-Workflows

### 3.1 Depot-Analyse (manuell)
- Orchestrator: Intent-Erkennung
- PDF/Screenshot → Claude (nativ) → strukturierte JSON-Extraktion
- Normalisierung: ISIN > WKN > Name als instrument_key
- Plausibilitätsprüfung → Incidents bei Fehlern
- Report-Generierung (Deutsch)

### 3.2 Snapshot speichern
- Nur bei explizitem Befehl
- Konsolidierung DKB + comdirect (gleiche ISIN zusammenführen)
- Schreiben in Azure Table Storage

### 3.3 Cashflow-Verarbeitung
- XLSX/CSV → Parsing → Klassifizierung (Haiku)
- Depot-relevante Cashflows erkennen
- Speichern auf expliziten Befehl

---

## Block 4 — Automation & Intelligence

### 4.1 Automatischer Preis-Update (GitHub Actions)
- Cron 06:00 + 20:00 Europe/Berlin
- Yahoo Finance API → Marktpreise für alle bekannten Positionen
- Fallback: Alpha Vantage
- Schreiben in `price_updates`-Tabelle
- Mini-Analyse via Haiku
- Alert-Prüfung → E-Mail wenn Schwellwert überschritten

### 4.2 Treiber-Analyse
- Tavily Web-Search (auf Anfrage)
- Top-5 Beitragsleister + Begründung mit Quellen
- Haiku für Search-Summary

### 4.3 E-Mail Alerting
- Azure Communication Services
- Alert-Konfiguration speichern/ändern via Chat
- One-shot pro Ereignis (kein Spam)

---

## Block 5 — UI & Historik

### 5.1 Lokale Web-UI (localhost:3000)
- Chat-Interface (Input, Response, File-Upload)
- Sidebar: letzte Snapshots, offene Incidents, aktive Alerts
- Mobile-fähig (Browser im selben WLAN)

### 5.2 Historischer Vergleich
- "letzter Snapshot", "vor 30 Tagen", "Jahresanfang"
- Delta-Berechnung: Positionen, Gewichtung, G/V
- Risikokennzahlen: Rolling Volatilität + Max Drawdown

### 5.3 Incidents-Workflow
- Anzeige offener Incidents in UI
- Auto-Auflösung via ISIN-Lookup (Haiku + Web)
- Manuelle Bestätigung / Schließen

---

## Reihenfolge & Abhängigkeiten

```
2.1 Projektstruktur
    └─ 2.2 Storage-Schicht
           └─ 2.3 v0-Import
           └─ 3.1 Depot-Analyse
                  └─ 3.2 Snapshot speichern
                  └─ 3.3 Cashflow
                         └─ 4.1 Preis-Update Cron
                         └─ 4.2 Treiber-Analyse
                         └─ 4.3 E-Mail Alert
                                └─ 5.1 Web-UI
                                └─ 5.2 Historik
                                └─ 5.3 Incidents
```

---

## Nächster Schritt: Block 2.1 starten

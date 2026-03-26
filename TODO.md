# TODO — agentic_depot_1
> Stand: 2026-03-26 | Aktualisiert nach Block 2

---

## Nächste Schritte (vor Block 3)

### [ ] Setup 1 — Anthropic API Key beschaffen
- console.anthropic.com → API Keys → "Create Key"
- Key in `.env` eintragen: `ANTHROPIC_API_KEY=sk-ant-...`
- Optional: Spending Limit setzen (Anthropic Console → Limits)

### [ ] Setup 2 — Azure Table Storage einrichten
- Azure Portal → Storage Account erstellen (empfohlen: LRS, Region West Europe)
- Connection String kopieren: Storage Account → Access Keys → Connection string
- In `.env` eintragen: `AZURE_STORAGE_CONNECTION_STRING=...`
- Smoke-Test: `npm install && npm run setup` → alle 7 Tabellen werden angelegt

### [ ] Setup 3 — .env anlegen
- `.env.example` kopieren → `.env`
- API Keys eintragen (Anthropic, Azure Storage)
- Tavily + Azure Communication Services kommen später (Block 4)

---

## Block 3 — Kern-Workflows (startet nach Setup 1-3)

### [ ] Block 3.1 — DKB CSV Parser
- `src/parsers/dkb-csv.js`
- Felder mappen: Datum, WKN, ISIN, Name, Einstiegskurs, Bewertungskurs, Stückzahl, G/V
- instrument_key-Logik: ISIN → WKN- → NAME-

### [ ] Block 3.2 — Claude Extraktion (PDF / Screenshot)
- `src/llm/extractor.js`
- comdirect PDF + Screenshots nativ via Claude Sonnet
- Prompt für strukturierte JSON-Ausgabe (Snapshot + Positionen)
- Incident-Erstellung bei fehlenden Pflichtfeldern

### [ ] Block 3.3 — Depot-Analyse Workflow
- `src/workflows/analyse.js`
- P1 Depot-Intake (CSV + PDF/Screenshot)
- P3 Report-Generierung (Deutsch, Sonnet)
- Plausibilitätsprüfung + Incidents

### [ ] Block 3.4 — Snapshot speichern
- Intent `analyse_and_save` + `save`
- Konsolidierung DKB + comdirect (gleiche ISIN zusammenführen)
- Cashflow-Intake (Block 3.5)

---

## Block 4 — Automation & Intelligence (nach Block 3)

### [ ] Block 4.1 — Automatischer Preis-Update (GitHub Actions)
- `.github/workflows/price-update.yml` — Cron 06:00 + 20:00 Europe/Berlin
- Yahoo Finance → Alpha Vantage Fallback
- Tavily API Key beschaffen (app.tavily.com)

### [ ] Block 4.2 — Treiber-Analyse (Tavily)
- `src/tools/webSearch.js`
- Top-5 Beitragsleister + Live-Recherche

### [ ] Block 4.3 — E-Mail Alerting
- Azure Communication Services einrichten
- Alert-Schwellwerte definieren (% / EUR-Werte)
- E-Mail-Adresse für Alerts konfigurieren

---

## Block 5 — UI & Historik (nach Block 4)

### [ ] Block 5.1 — Lokale Web-UI (localhost:3000)
### [ ] Block 5.2 — Historischer Vergleich
### [ ] Block 5.3 — Incidents-UI + Risikokennzahlen

---

## Erledigt

- [x] Repository `agentic_depot_1` erstellt
- [x] Initialer Input (Block 0 & Block 1) eingecheckt
- [x] Initiale Bewertung durch Claude eingecheckt
- [x] v0-Artefakte eingecheckt (v0/input/: CSV, PDF, Screenshot, Cashflow, YAML, JS, Hinweise)
- [x] v0.5 HLD eingecheckt (v0/hld_v0.5.md)
- [x] Architekturentscheidung: Pfad 3 — eigene lokale Node.js App
- [x] HLD v0, v2, v3 erstellt und eingecheckt (hld/)
- [x] Implementierungsplan erstellt (IMPLEMENTATION_PLAN.md)
- [x] Block 2.1 — Projektstruktur, package.json, .env.example, .gitignore
- [x] Block 2.2 — Azure Storage-Schicht (7 Tabellen, CRUD, Batch-Ops)

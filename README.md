# agentic_depot_1

Persönliches agentic Depot-Analyse-System für DKB + comdirect.

## Struktur

```
agentic_depot_1/
├── docs/
│   ├── hld.md                  ← Aktuelles High-Level Design (v3)
│   ├── implementation-plan.md  ← Implementierungsplan (5 Blöcke)
│   └── archive/                ← Ältere Versionen & Artefakte
├── src/                        ← Quellcode
│   ├── storage/                ← Azure Table Storage Client + Tabellen
│   ├── llm/                    ← Claude API Wrapper
│   ├── tools/                  ← Tavily, Yahoo Finance, Alpha Vantage
│   ├── workflows/              ← Orchestrator, Intent-Routing
│   ├── parsers/                ← DKB CSV, comdirect PDF, Cashflow
│   └── alerts/                 ← Alert-Engine
├── scripts/                    ← Setup & Import-Skripte
├── data/
│   └── v0/                     ← Initialdaten (DKB CSV, comdirect PDF, etc.)
├── .github/
│   └── workflows/              ← GitHub Actions (Preis-Cron, Alerts)
├── .env.example                ← Vorlage für API Keys
├── package.json
└── TODO.md
```

## Schnellstart

```bash
# 1. Repository klonen
git clone https://github.com/xamjamchok-debug/agentic_depot_1.git
cd agentic_depot_1

# 2. Dependencies installieren
npm install

# 3. .env anlegen
cp .env.example .env
# → API Keys eintragen (Anthropic, Azure Storage)

# 4. Azure Table Storage initialisieren
npm run setup

# 5. App starten
npm start
```

## Voraussetzungen

- Node.js >= 18
- Anthropic API Key (console.anthropic.com)
- Azure Storage Account (portal.azure.com)

## Architektur

Siehe `docs/hld.md` für das vollständige High-Level Design.

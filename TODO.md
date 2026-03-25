# TODO — agentic_depot_1
> Stand: 2026-03-25 | Erstellt auf Basis der initialen Bewertung durch Claude

---

## Offen

### [ ] Task 1 — Block 0 abschliessen: Alle Accounts & Tools einrichten
- GitHub, Azure, Excel Online, Claude Account anlegen
- VS Code, Git, Node.js >= 18, Azure CLI installieren
- `az login` testen
- Smoke-Check: `git status` clean, Claude API Key vorhanden

### [ ] Task 2 — Block 1: System definieren
- `ai/system.md` mit Architekturprinzipien befuellen
- `workflows/depot-analysis.md` anlegen
- Intent-Modell Chat vs. Workflow definieren
- `ai/constraints.md`, `ai/prompts/intent.md`, `normalize.md` erstellen
> Blocked by: Task 1

### [ ] Task 3 — Externe Tool-Abhaengigkeiten klaeren (OCR, News-API, Marktdaten)
- Konkrete APIs auswaehlen: OCR/ASR, News-Suche, Marktdaten
- Kosten und Rate Limits pruefen
- Ergebnis in `ai/constraints.md` dokumentieren
> Blocked by: Task 1

### [ ] Task 4 — Auth-Strategie festlegen fuer Chat UI
- Entscheiden: Static API Key (PoC) oder Azure AD B2C (Produktion)
- Strategie in `ai/system.md` dokumentieren
- `.env` Vorlage anlegen
> Blocked by: Task 1

### [ ] Task 5 — Budget-Guards einrichten
- Azure: Cost Alert bei z.B. 50 EUR/Monat setzen
- Anthropic Console: Spending Limit konfigurieren
- Bestaetigung in `logs/` ablegen
> Blocked by: Task 1

### [ ] Task 6 — Orchestrator Fehlerbehandlung & Retry-Strategie definieren
- Verhalten bei LLM-Timeout und Tool-Fehler spezifizieren
- Retry-Logik (max. Versuche, Backoff) und Fallback dokumentieren
- In `workflows/depot-analysis.md` erganzen
> Blocked by: Task 2

### [ ] Task 7 — Persistenz-Migrationspfad von Excel zu Azure Storage dokumentieren
- Migrationspfad: Excel Online (PoC) -> Azure Table Storage / Cosmos DB
- Kriterien fuer den Wechsel festlegen
- In `ai/constraints.md` dokumentieren
> Blocked by: Task 2

---

## Erledigt

- [x] Repository `agentic_depot_1` erstellt
- [x] Initialer Input (Block 0 & Block 1) eingecheckt unter `input/block0_block1_initial.md`
- [x] Initiale Bewertung durch Claude eingecheckt unter `evaluation/initial_evaluation.md`

BLOCK 0 — Grundlagen schaffen
Ziel:

Du kannst lokal entwickeln

Alle externen Abhängigkeiten sind geklärt

Block 1 kann ohne Stolperfallen starten

0.1 Grundvoraussetzungen (5 Min)
Lokaler Rechner (Windows / macOS / Linux)

Admin‑Rechte

Browser (Chrome / Edge / Firefox)

0.2 Accounts einrichten (30–45 Min)
0.2.1 GitHub (Pflicht)
Wofür: Versionierung, Prompt‑Ablage, Architektur‑Gedächtnis

0.2.2 Azure Account (Pflicht)
Wofür: Backend, Orchestrator‑API, Persistenz

0.2.3 Microsoft Account / Excel Online (Pflicht)
Wofür: Auditierbarer Datenspeicher

0.2.4 Claude (Anthropic) Account (Pflicht)
Wofür: Primäres Denk & Analyse‑LLM

0.3 Lokale Tools: VS Code, Git, Node.js >= 18, Azure CLI, Claude Desktop

0.4 Repo initialisieren: git clone, Grundstruktur ai/ prompts/ workflows/ backend/ ui/ logs/

0.5 Secrets: .env lokal, .gitignore enthaelt .env

0.6 Mini-Smoke-Check: git status clean, az login, Claude API Key, Excel-Tabelle

BLOCK 1 — Definition
Ziel: System definieren, bevor irgendwas programmiert wird.

ARCHITEKTUR:
Zentrales Prinzip: Baue kein GPT. Baue ein System, das LLMs benutzt.

[ ChatGPT-like Web UI ]
        ↓
[ Chat Orchestrator API ] <- KERN
        ↓
[ LLMs (Claude & GPT) ] + [ Tools / APIs ]
        ↓
[ Persistenz (Excel / Storage / DB) ]

Rollen: Web UI (kein Logik), Orchestrator (Intent, Workflow, Prompt, Tool-Routing, State, Persistenz), LLMs (Normalisierung, Bewertung, Analyse), Tools (OCR, News, Marktplaetze, Excel)

Tech: Azure Backend, Excel PoC-Storage, Claude API primaer, Next.js UI, GitHub als Langzeitgedaechtnis

MASTER-PROMPT: Senior Agentic-AI Architekt fuer Depot- und Finanzanalysen.
Inputs: CSV, Screenshots, Freitext, Audio, Cashflow
Aufgaben: Normalisierung, Marktpreise, Performance, Segmentierung, Risiko, Empfehlungen mit Confidence-Level

Abgrenzungen:
NEIN: Custom GPT, GPT Actions, monolithischer Prompt, unkontrollierte Web-Recherche, LLM rechnet Zahlen
JA: Mehrstufige Workflows, klare State-Modelle, Auditierbarkeit, austauschbare Modelle, Evolvierbarkeit

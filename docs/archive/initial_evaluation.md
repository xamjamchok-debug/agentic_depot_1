# Initiale Bewertung — Block 0 & Block 1
> Datum: 2026-03-25
> Bewertet von: Claude (claude-sonnet-4-6)

---

## Gesamteindruck: Solide, pragmatisch, produktionsnah denkbar

---

## Staerken

- **Architekturprinzip ist klar und richtig:** "Baue kein GPT, baue ein System das LLMs benutzt" — das ist der entscheidende Unterschied zwischen einem Spielzeug und einer ernsthaften Applikation.
- **Klare Rollentrennung:** UI / Orchestrator / LLM / Persistenz ist sauber. Der Orchestrator als Kern ist der richtige Ansatz.
- **Negative Abgrenzungen explizit:** Die NEIN-Liste ist wertvoll. Viele Projekte scheitern weil diese Grenzen nie gezogen wurden.
- **Iterativer Ansatz:** Excel als PoC-Storage ist pragmatisch — lieber fertig als perfekt.
- **GitHub als AI-Gedaechtnis:** Prompts, Workflows und Constraints versioniert zu halten ist architektonisch reif.

---

## Risiken & Luecken

| Bereich | Problem | Empfehlung |
|---|---|---|
| Persistenz | Excel Online skaliert nicht — Race Conditions bei parallelen Writes | Frueh auf Azure Table Storage oder Cosmos DB migrieren |
| Externe Tools | OCR/ASR, News-Suche, Marktplaetze: keine konkreten APIs genannt | Vor Block 2 klaeren (welcher Anbieter, Kosten, Rate Limits) |
| Auth/AuthZ | Chat UI hat keine Authentifizierungsstrategie | Azure AD B2C oder einfacher: Static API Key am Start |
| Kosten | Azure + Claude API ohne Budget-Guard | Spending Limits frueh setzen (Azure Cost Alerts, Anthropic Limits) |
| Testing | Keine Teststrategie erwaehnt | Mindestens: Input-Fixture -> erwarteter Output fuer jeden Workflow |
| Fehlerbehandlung | Orchestrator-Verhalten bei LLM-Timeout/Fehler unklar | Retry-Logik und Fallback-Strategie in Block 1 definieren |

---

## Bewertung nach Kategorien

- Architektur: 5/5
- Umsetzbarkeit Block 0: 4/5 — kleine Luecken bei Tool-Versionen
- Vollstaendigkeit: 3/5 — Block 1+ noch skizzenhaft
- Produktionsreife als Gesamtplan: 4/5

---

## Fazit

Sehr guter Startpunkt. Das Grundgeruest ist durchdacht. Die groessten Risiken liegen nicht in der Architektur, sondern in den noch undefinierten externen Abhaengigkeiten (APIs, Auth, Kosten).

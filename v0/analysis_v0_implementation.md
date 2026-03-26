# Fachliche Analyse — v0 Implementierung (ChatGPT + Google Sheets)
> Datum: 2026-03-26
> Analysiert von: Claude (claude-sonnet-4-6)
> Status: Ansatz verworfen — dient als fachliche Referenz fuer Neuimplementierung

---

## Kontext

Der erste Implementierungsversuch basierte auf:
- Custom GPT (ChatGPT) als Analyse- und Steuerungseinheit
- Google Apps Script (JavaScript) als Backend / Web App
- Google Sheets als Persistenzschicht (3 Tabs: snapshots, positions, cashflows)
- OpenAPI YAML Schema fuer GPT Actions

Dieser Ansatz ist **architektonisch verworfen**. Die fachlichen Anforderungen
und das Datenmodell bleiben jedoch als Grundlage erhalten.

---

## Was fachlich gut durchdacht war

- **Snapshot-Konzept:** Depot-Zustand zu einem Zeitpunkt einfrieren, getrennt von Positionen speichern. Richtig.
- **instrument_key als Bruecke** zwischen ISIN, WKN und Freitext — kluger Ansatz fuer Multi-Broker.
- **Cashflow-Typen-Enum** (buy/sell/dividend/fee/tax/deposit/withdrawal) deckt die Realitaet ab.
- **Explizites Speicher-Kommando** statt Auto-Save — fachlich und datenschutzrechtlich korrekt.
- **Multi-Broker-Unterstuetzung** (DKB + comdirect) — notwendig und bestaetigt durch echte Daten.
- **Robuste Cashflow-Felder** im Apps Script (akzeptiert cashflows/rows/entries/items, alternative Feldnamen) — pragmatisch.

---

## Konkrete Luecken im alten Datenmodell (sichtbar aus echten Input-Dateien)

| Luecke | Quelle | Impact |
|---|---|---|
| `entry_price` fehlt im Positionsschema | DKB CSV hat "Einstiegskurs", comdirect hat "Kaufkurs" | P&L nicht eigenstaendig berechenbar |
| `market_value_eur` nicht direkt geliefert (DKB) | Muss berechnet werden: Stueckzahl x Preis | Normalisierungslogik notwendig |
| Keine `currency` pro Position | Einige ETFs notieren in USD | FX-Risiko nicht abbildbar |
| Keine `theme` Felder | System-Prompt erwaehnt Themen-Aggregation | Aktuell nicht persistierbar |
| `source_format` fehlt | Kein Hinweis ob CSV, PDF oder Screenshot | Qualitaetsbewertung nicht moeglich |
| `purchase_value_eur` fehlt | Kaufwert (Stueckzahl x Einstandskurs) | Mischkurs-Berechnung aufwendig |

---

## Warum der ChatGPT + Google Sheets Ansatz gescheitert ist

### 1. GPT-Instabilitaet bei Feldnamen (strukturelles Problem)
- GPT erzeugte falsche Feldnamen: `timestamp` statt `timestamp_berlin`, `total_value_eur` statt `portfolio_value_eur`
- Nicht durch bessere Prompts loesbar — GPT kann keine 100% deterministische JSON-Erzeugung garantieren
- **Loesung im Neusystem:** Orchestrator validiert und korrigiert Output, LLM erzeugt kein finales JSON

### 2. Falsches Action-Routing (Cashflow vs. Snapshot)
- GPT verwendete `append_snapshot` statt `append_cashflows` fuer Cashflow-Dateien
- **Ursache:** Intent-Erkennung lag beim LLM, nicht beim Orchestrator
- **Loesung im Neusystem:** Orchestrator erkennt Intent deterministisch

### 3. OpenAPI Schema-Probleme
- Parse errors, zu generische Payload-Beschreibung, Action-Parameterfehler
- `/exec` URL-Problematik (Google Apps Script)
- **Loesung im Neusystem:** Sauberes, versioniertes API-Schema unter Kontrolle des Entwicklers

### 4. Performance-Problem bei Massendaten
- `appendRow` in Schleife fuer 100-200 Zeilen: mehrere Minuten Laufzeit
- Bereits im Apps Script auf `setValues` (Batch-Write) umgestellt — richtig
- **Loesung im Neusystem:** Bulk-Writes von Anfang an, kein zeilenweises Schreiben

### 5. Google Sheets als Datenbank — strukturelle Schwaeche
- Race Conditions bei parallelen Writes (mehrere Snapshots pro Tag geplant)
- Keine Transaktionssicherheit
- Skaliert nicht bei wachsender Snapshot-Frequenz
- **Loesung im Neusystem:** Azure Cosmos DB (Prod) / SQLite (PoC)

### 6. GPT extrahierte nur Teilmenge der Cashflows (19 von ~200)
- Wahrscheinlich: nur depot-relevante Buchungen extrahiert — fachlich moeglicherweise korrekt
- Aber: nicht transparent und nicht steuerbar
- **Loesung im Neusystem:** Scope explizit definiert (nur depot-relevante Transaktionen), Extraktion dokumentiert

---

## Beibehaltene fachliche Elemente

- Datenmodell-Struktur (snapshots / positions / cashflows) — behalten, erweitert
- Cashflow-Typen-Enum — behalten
- Kommandosprache (analysiere / speichere / vergleiche) — behalten, formalisiert
- Report-Struktur (Summary / Datenqualitaet / Positionen / Aggregation / Treiber / Ausblick) — behalten
- Transaktionserkennung (Cashflow-Matching primaer, Stueckzahl-Vergleich als Fallback) — behalten

---

## Entscheidung

Technischer Stack wird vollstaendig ersetzt.
Fachliche Logik, Datenmodell und Kommandosprache werden uebernommen und verfeinert.
Siehe: `v0/hld_v0.5.md`

# Klaerungsfragen & Antworten — Session 1
> Datum: 2026-03-26
> Zweck: Grundlage fuer fachliches HLD v0.5

---

## Q1 — Multi-Depot-Aggregation
**Frage:** Sollen beide Depots (DKB + comdirect) zu einem Gesamtportfolio-Wert aggregiert werden, oder immer getrennt betrachtet?

**Antwort:** Zusammen — beide Depots bilden ein aggregiertes Gesamtportfolio.

---

## Q2 — comdirect Input-Format
**Frage:** Ist PDF-Export das primaere Format von comdirect, oder exportierst du auch CSVs / nutzt Screenshots?

**Antwort:** Alle moeglichen Quellen werden genutzt (Screenshots, CSV, PDF). PDF ist primaeres Format wenn ok.

---

## Q3 — Cashflow-Scope
**Frage:** Nur depot-relevante Transaktionen oder alle Kontobewegungen?

**Antwort:** Nur depot-relevante Transaktionen — Ein- oder Ausgaenge zum/vom Depot.

---

## Q4 — Themen-Klassifizierung
**Frage:** Wer vergibt Themen (z.B. "Emerging Markets", "Rohstoffe")? LLM automatisch oder manuell?

**Antwort:** LLM vergibt Themen automatisch nach Recherche wenn erforderlich.

---

## Q5 — Zielallokation
**Frage:** Gibt es eine Zielgewichtung fuer das Portfolio gegen die Rebalancing-Empfehlungen berechnet werden sollen?

**Antwort:** Nein — keine Zielallokation definiert.

---

## Q6 — Snapshot-Frequenz
**Frage:** Wie oft werden Snapshots erstellt — taeglich, woechentlich, nach Kauf/Verkauf?

**Antwort:** Mehrmals taeglich moeglich.

**Implikation:** Persistenzschicht muss Hochfrequenz-Writes unterstuetzen. Excel/Sheets nicht geeignet fuer Produktion.

---

## Q7 — Marktdaten fuer Risikokennzahlen
**Frage:** Woher kommen Zeitreihen-Kursdaten fuer Volatilitaet & Max Drawdown — externe API oder eigene Snapshots?

**Antwort:** Externe API wenn frei verfuegbar und aufwandsneutral (z.B. Yahoo Finance, Alpha Vantage).

**Implikation:** API-Auswahl steht noch aus (offene Entscheidung).

---

## Q8 — Einstandskurs / Mischkurs
**Frage:** Reicht Einstiegskurs aus Broker-Export, oder soll Kaufhistorie (Mischkurs bei mehreren Kaeufen) getrackt werden?

**Antwort:** Mischkurs — wird wenn moeglich angeliefert, sonst berechnet.

**Implikation:** Datenmodell benoetigt `entry_price` + `purchase_value_eur`. Mischkurs-Berechnung aus Cashflow-Historie wenn kein direkter Wert vorliegt.

---

## Q9 — instrument_key-Logik
**Frage:** Wie soll der instrument_key gebildet werden?

**Antwort:** Entscheidung delegiert an Claude.

**Entscheidung:** ISIN wenn vorhanden (normalisiert), sonst "WKN-" + WKN, sonst "NAME-" + slug(name_raw) (markiert als unsicher). Gleicher Key fuer dasselbe Papier ueber alle Broker hinweg.

---

## Q10 — Steuerliche Daten
**Frage:** Sollen Vorabpauschale, Verlustverrechnungstopf, Kapitalertragsteuer Teil der Anwendung sein?

**Antwort:** Nicht relevant zum jetzigen Zeitpunkt — explizit ausgeschlossen.

---

## Q11 — Empfehlungs-Tiefe
**Frage:** Nur qualitativ oder mit konkreten Betraegen/Stueckzahlen?

**Antwort:** Qualitativ als Standard. Auf explizite Anfrage: konkrete Betraege/Stueckzahlen.

---

## Q12 — Nutzerkreis
**Frage:** Nur persoenlich oder spaeter Multi-User?

**Antwort:** Nur ein Nutzer aktuell. Multi-User nicht geplant.

---

## Q13 — Web-Recherche
**Frage:** Live-Web-Recherche (News-API) oder nur LLM-Wissen?

**Antwort:** Live-Web-Recherche — ganz wichtig. Zwingend fuer Treiber-Analyse und Ausblick.

**Implikation:** News-API ist Pflichtkomponente, kein Optional. Konkrete API-Auswahl steht noch aus.

---

## Q14 — DKB Screenshot vs. CSV
**Frage:** Wann Screenshot, wann CSV?

**Antwort:** Je nach Verfuegbarkeit und Situation — CSV wenn am PC, Screenshot wenn schnell vom Handy.

**Implikation:** Beide Pfade muessen vollstaendig unterstuetzt sein. System erkennt Format automatisch.

---

## Q15 — Alerting
**Frage:** Aktive Warnungen oder nur auf Anfrage?

**Antwort:** Aktiv — System soll selbststaendig warnen bei relevanten Ereignissen.

**Implikation:** Alert-Engine als eigenstaendige Komponente erforderlich (Hintergrund-Prozess, Schwellwert-Ueberwachung, Push-Benachrichtigung).

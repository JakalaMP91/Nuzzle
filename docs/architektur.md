# Architektur von Nest

Stand: 15.11.2026, veröffentlichte Version 0.6.0. Seit 16.11.2026 liegt die maßgebliche Arbeitskopie im privaten Projektverzeichnis; siehe `AGENTS.md`. Maßgeblich für Details ist der aktuelle Quellcode.

## Überblick

Nest ist eine private Haushalts-Web-App für Einkaufsliste, Rezepte und Aufgaben. React und TypeScript bilden die Oberfläche; das Next-App-Router-Modell wird mit Vinext und Vite als Cloudflare Worker gebaut. Die Oberfläche liegt überwiegend in `app/page.tsx`, das Styling in `app/globals.css`. Wiederverwendbare Regeln und Dienste liegen in `lib/`, UI-Bausteine in `components/`.

```text
Browser/PWA ── lokale Daten und Geräteeinstellungen
     │
     ├── Cloudflare Access ── Worker: app/api/* ── D1 (DB)
     │                                  ├── Gemini: Rezeptimport
     │                                  └── Web-Push-Dienst
     └── Service Worker: public/sw.js      ▲
                         Worker-Cron ───────┘
```

Die App kann lokal ohne gemeinsamen Speicher genutzt werden. `nest-local-v1` enthält Daten und UI-Zustand im Browser. Ein Teil des UI-Zustands, Hinweise und Lesestatus sind gerätespezifisch. Eine JSON-Sicherung enthält Haushaltsdaten einschließlich Bildern. Unterschiedliche Ursprünge teilen ihren Browserspeicher nicht.

## Gemeinsame Daten und Konflikte

`lib/household-data.ts` definiert und validiert den gemeinsamen Datensatz. `lib/use-household-sync.ts` verwaltet Verbindung, Revision, lokalen gemeinsamen Ausgangsstand, verzögertes Speichern und Abruf. `lib/household-service.ts` und `app/api/household/route.ts` bedienen die API. D1 speichert den Haushaltsdatensatz mit Revision; konkurrierende Schreibzugriffe werden erkannt. `lib/household-merge.ts` führt geeignete unabhängige Änderungen anhand des gemeinsamen Ausgangsstands zusammen. Einkaufsdaten und Rezepte werden getrennt betrachtet. Gleichzeitige reine Ergänzungen im Einkaufsbereich können anhand stabiler IDs zusammengeführt werden; Änderungen, Löschungen oder widersprüchliche Reihenfolgen bleiben dort bei gleichzeitiger Bearbeitung geschützt. Das Sync-Protokoll kann den Konfliktbereich ohne Inhalte benennen. Bei nicht auflösbaren Konflikten bleiben lokale Änderungen erhalten; vor dem Ersetzen wird gesichert und bestätigt. Beim offenen Editor wird das Übernehmen fremder Daten ausgesetzt.

Rezept- und Aufgabenbilder werden über `app/api/household-image/` und `lib/household-images.ts` separat in D1 gespeichert. Der gemeinsame Datensatz ohne Bilder ist auf 1,5 MB begrenzt. Bestehende Browserdaten und alte Datenstrukturen müssen bei Änderungen kompatibel bleiben. Nicht mehr verwendete Bilddaten werden derzeit nicht automatisch entfernt. Technische Sync-Ereignisse bleiben im Browser und können in den Einstellungen heruntergeladen werden.

## Identität, Import und Push

Cloudflare Access schützt den Worker. `lib/household-auth.ts` prüft zusätzlich das signierte Access-Token und den zugelassenen Nutzer für geschützte APIs. Die Benutzerzuordnung liegt in `lib/household-identity.ts`. Access-Einstellungen und erlaubte Konten nicht aus dem Code ableiten oder verändern, ohne die bestehende Konfiguration zu prüfen.

`app/api/recipe-import/route.ts` verarbeitet Rezepttext, Links und Dateien mit Gemini. Die Extraktion und Nachbearbeitung liegen in `lib/recipe-*`. Der Aufruf erfolgt erst nach Nutzeraktion. Der Schlüssel liegt lokal in `.env.local` oder produktiv als Worker-Secret.

`public/sw.js` empfängt Push und behandelt Benachrichtigungsklicks; er ist kein Offline-Cache. `lib/use-push-notifications.ts`, `app/api/push/route.ts` und `lib/push-*` verwalten Anmeldung und Versand. Der Worker-Scheduler meldet neue Kommentare aus aktualisierten App-Versionen an die Geräte des jeweils anderen Kontos und neue Aufgaben des anderen Kontos an relevante Empfänger, prüft Aufgabentermine und, falls pro Gerät aktiviert, Einkaufsereignisse regelmäßig. Ein explizites `createdAt` verhindert nachträgliche Neumeldungen alter Aufgaben. Geräteeinstellungen liegen in `push_subscription`. Einkaufsmeldungen werden aus noch vorhandenen Einträgen und der Einkaufshistorie mit Karenzzeit abgeleitet. Die gerätebezogene Push-Diagnose speichert ausschließlich technische Kategorien und Statuscodes lokal sowie im bestehenden Versandprotokoll; der Export filtert Endpunkte, IDs und Inhalte. Details und Grenzen stehen in `push-benachrichtigungen.md`.

## Datenbank und Betrieb

Das Drizzle-Schema liegt in `db/schema.ts`, SQL-Migrationen in `drizzle/`. Die Push-Migration ergänzt eigene Tabellen. Den tatsächlichen Migrationsstand vor Datenbankänderungen prüfen und eine Sicherung einplanen. `public/manifest.webmanifest` und die Nest-Icons definieren die installierbare PWA. Der Browser entscheidet über Aktualisierung und Anzeige des Icons.

Zuletzt verwendete Einkaufsvorschläge speichern bei Abschluss `lastPurchasedAt`; ältere Zeitstempel-IDs dienen als Fallback. `lib/shopping-recent.ts` gruppiert nach Berliner Kalendertagen, unbekannte Daten bleiben gesondert. Weitere Regeln zu Mengen, Sortierung, Einkauf und Benutzeroberfläche stehen in der README. Die Deployment-Anleitung beschreibt den Produktionsaufbau, Bindungen und Prüfung.

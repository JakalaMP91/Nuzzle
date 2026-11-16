# Deployment und Betrieb

Version 0.7.3 wurde am 16.11.2026 veröffentlicht. Sie passt Home-Farben, Hinzufügen-Aktionen und das violette Logo an. Datenbankbindung, Secrets, Handler, Cron und Zugriffsschutz wurden nach dem Deployment geprüft. Eine Migration war nicht erforderlich. Die Darstellung und Funktionen auf angemeldeten Geräten sind noch zu prüfen.

Version 0.7.2 wurde am 16.11.2026 veröffentlicht. Sie ergänzt das grüne Icon, die Ladeanimation und das pro Browser umschaltbare Farbschema. Die bestehende D1-Bindung, Secrets, Handler, Cron und der Zugriffsschutz wurden geprüft. Eine Migration war nicht erforderlich. Die Darstellung, Icon-Aktualisierung, Synchronisierung und Push-Zustellung auf angemeldeten Geräten sind noch zu prüfen.

Version 0.7.1 wurde am 16.11.2026 veröffentlicht. Die Kaffee-Ansicht wurde überarbeitet; eine Datenbankmigration war nicht erforderlich. Nach der Aktivierung wurden Bindungen, Tabellen, Cron und Zugriffsschutz geprüft. Die neue Ansicht wurde lokal mit Beispieldaten geprüft; ein angemeldeter Test auf dem Tablet steht noch aus.

Stand: 16.11.2026. Version 0.7.0 mit dem Kaffee-Bereich wurde veröffentlicht. Die additive Migration `drizzle/0005_coffee.sql` wurde nach Prüfung des Schemas und eines Wiederherstellungspunkts angewendet. Cloudflare-Bindungen, Zugriffsschutz, Tabellen und Cron wurden nach der Aktivierung geprüft. Der angemeldete Kaffee-Import und die Synchronisierung auf echten Geräten sind noch zu prüfen. Die konkrete Worker-Adresse und weitere lokale Betriebsangaben liegen in der ignorierten Datei `.nest-private/deployment-before-privacy.md`. Vor einem Deployment den aktuellen Produktionsstand und das Ziel prüfen.

Die additive Migration `drizzle/0003_push_preferences.sql` wurde am 15.11.2026 auf der produktiven D1-Datenbank angewendet, nach Prüfung des Schemas und eines Wiederherstellungspunkts. Nicht erneut anwenden.

Version 0.3.1 wurde am 15.11.2026 veröffentlicht und erweitert die sichere Zusammenführung von Einkaufsänderungen. Keine Datenbankmigration erforderlich.

Version 0.4.0 wurde am 15.11.2026 veröffentlicht. Sie verbessert die Wiederherstellung der Push-Registrierung, ergänzt Neumeldungen für Aufgaben und verwendet das Haus-mit-Herz-Icon. Keine Datenbankmigration erforderlich.

Version 0.4.1 wurde am 15.11.2026 veröffentlicht und ergänzt Einkaufsdatumsgruppen, Mengenwahl und direkte Artikeleingabe. Das zusätzliche optionale Feld benötigt keine Datenbankmigration.

Version 0.5.0 wurde am 15.11.2026 veröffentlicht. Die additive Migration `drizzle/0004_push_diagnostics.sql` für den Anbieterstatus in `push_delivery` wurde nach Schema- und Wiederherstellungspunktprüfung auf Produktion angewendet und darf nicht erneut ausgeführt werden.

Version 0.6.0 wurde am 15.11.2026 veröffentlicht. Sie ergänzt Kommentar-Push und berechnet häufig verwendete Artikel aus der Einkaufshistorie. Eine Datenbankmigration war nicht erforderlich. Der bestehende Fünf-Minuten-Cron blieb unverändert.

## Produktive Infrastruktur

- D1-Binding: `DB`. Bilder und Haushaltsdaten liegen in derselben produktiven Datenbank. Keine Tabellen löschen und Migrationen nur nach Prüfung des aktuellen Stands ausführen.
- Der Worker hat `fetch` und `scheduled`. Der Cron wurde am 15.11.2026 auf `* * * * *` umgestellt. Vor Änderungen den tatsächlich eingerichteten Zeitplan und weitere Trigger prüfen und erhalten.
- Cloudflare Access schützt die App. Die Worker-Secrets heißen `NEST_ACCESS_TEAM_DOMAIN`, `NEST_ACCESS_AUDIENCE`, `NEST_ALLOWED_EMAILS`, `NEST_COMMENT_AUTHORS`, `GEMINI_API_KEY`, `NEST_VAPID_PUBLIC_KEY`, `NEST_VAPID_PRIVATE_KEY` und `NEST_VAPID_SUBJECT`. Nur Namen dokumentieren. Werte und bestehende VAPID-Schlüssel erhalten.
- `.openai/hosting.json` enthält eine lokale Binding-Deklaration, aber keine Sites-Projekt-ID. Die aktuelle Veröffentlichung erfolgte direkt über Cloudflare Wrangler, nicht über einen Sites-Deploy. Kein neues Projekt oder Remote anlegen.

## Vorbereitung

1. Projektstand und produktives Ziel prüfen, ungesicherte Änderungen bewahren und App-Version samt Lockdatei aktualisieren. Bei jedem Release die Dokumentation prüfen und bei Änderungen aktualisieren, einschließlich dieser Datei und `AGENTS.md`.
2. Sinnvolle Tests und `npx tsc --noEmit` ausführen. Mit `npm run build` den Worker erzeugen. Der Build legt `dist/server/index.js`, `dist/server/wrangler.json` und `dist/client` an; `dist/` ist generiert und ignoriert.
3. `node scripts/prepare-push-worker.mjs` ausführen. Dadurch entstehen `dist/server/push-worker.js` und `push-scheduled.js`. Ohne diesen Einstieg fehlt der geplante Push-Handler.
4. Eine Deployment-Konfiguration aus dem aktuellen `dist/server/wrangler.json` vorbereiten. Sie muss den bestehenden Worker als `name` und `topLevelName`, `push-worker.js` als `main`, die bestehende DB-Bindung und den vorhandenen Cron enthalten, aktuell `* * * * *`. Vor der letzten Veröffentlichung wurde für `DB` ein Wrangler-Inherit-Binding verwendet und der Zeitplan vorab über Cloudflare abgefragt. `workers_dev` war aktiviert und `preview_urls` deaktiviert. Bestehende Routen, weitere Trigger, Observability und Secrets nicht versehentlich ändern. `scripts/prepare-cloudflare-config.mjs` allein erzeugt nur die Grundkonfiguration mit `index.js`, nicht die fertige Push-Konfiguration.
5. Zugriff mit dem vorgesehenen privaten Cloudflare-Konto prüfen. Anmeldung und Token nicht ausgeben oder in Projektdokumenten speichern. Der private Wrangler-Konfigurationsordner liegt unter `.cloudflare-auth` im Projektverzeichnis und ist von Git ausgeschlossen. Für den Aufruf in PowerShell ` $env:XDG_CONFIG_HOME = (Join-Path (Get-Location) ".cloudflare-auth")` setzen. Falls die Anmeldung fehlt oder abgelaufen ist, eine geeignete Anmeldung herstellen. Keine Zugangsdaten in das Repository kopieren.

Am 16.11.2026 wurde `NEST_COMMENT_AUTHORS` als Cloudflare-Secret im bestehenden Worker eingerichtet; dabei wurde eine neue Worker-Version aktiviert. Vor dem nächsten Deployment prüfen, dass das Secret erhalten bleibt. Die ignorierte Datei `.nest-private/comment-authors.json` enthält die bestehende Zuordnung als JSON von E-Mail-Adressen zu Kommentarnamen. Ohne gültige Zuordnung werden keine Kommentarnamen erkannt, neue Kommentare sind gesperrt und die Push-Geräteverwaltung lehnt Anfragen ab. Keine Werte in Git oder Logs ausgeben. Die laufende Version nutzt diese Einstellung.

## Hochladen und Umschalten

Mit dem im Projekt installierten Wrangler und der zuvor geprüften Konfiguration eine neue Version hochladen, beispielsweise:

```powershell
node .\node_modules\wrangler\bin\wrangler.js versions upload --config dist/server/wrangler.inherit.json --keep-vars --message "Nuzzle <Version>"
node .\node_modules\wrangler\bin\wrangler.js versions view <Worker-Version-ID> --config dist/server/wrangler.inherit.json
node .\node_modules\wrangler\bin\wrangler.js versions deploy <Worker-Version-ID>@100 --config dist/server/wrangler.inherit.json --yes --message "Nuzzle <Version>"
node .\node_modules\wrangler\bin\wrangler.js deployments list --config dist/server/wrangler.inherit.json
```

`wrangler.inherit.json` ist eine generierte, ignorierte Datei und muss vorab passend vorbereitet werden. Inherit-Bindings und `--keep-vars` schützen die vorhandene Konfiguration nur, wenn sie vorab korrekt geprüft wurden. Die hochgeladene Version vor dem Umschalten auf `fetch`, `scheduled`, das richtige D1-Binding und die Namen der Secrets prüfen. Das Kommando `versions deploy` aktualisiert nicht automatisch Cron oder andere Trigger. Diese separat nur bei Bedarf und nach Prüfung ändern.

## Nach dem Deployment

Aktives Deployment und Versionsverteilung prüfen. Wenn möglich, Anmeldung, Einstellungen mit angezeigter Version, Synchronisierung und Push-Test auf den betroffenen Geräten prüfen. Tatsächliche Zustellung und Änderungen des PWA-Icons können nur auf Geräten bestätigt werden. Bei Fehlern den letzten funktionierenden Worker-Stand und die Datenverträglichkeit prüfen, bevor ein Rollback erfolgt. Lokale Änderungen und Nutzerdaten nicht überschreiben. Ergebnisse und verbleibende Prüfgrenzen dokumentieren.

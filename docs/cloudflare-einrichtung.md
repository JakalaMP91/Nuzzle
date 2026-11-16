# Vorbereitung für Cloudflare

Stand 15.11.2026: Nuzzle ist bereits über Cloudflare Workers mit D1 und Access veröffentlicht. Diese Datei beschreibt die ursprüngliche Ersteinrichtung. Für den bestehenden produktiven Betrieb und Releases gilt `deployment.md`. Es gibt keinen Kalenderzugriff.

## Vor einer Nutzung mit echten Daten

1. Google als Identitätsanbieter in Cloudflare Zero Trust einrichten. Die Access-Richtlinie auf die beiden konkreten Google-Adressen begrenzen. Die Google-Anmeldung allein gewährt keinen Kalenderzugriff.
2. Eine leere D1-Datenbank für Nuzzle anlegen. Die Migration `drizzle/0000_marvelous_firebrand.sql` einmalig auf diese Datenbank anwenden. Nicht auf eine bereits produktiv genutzte Datenbank anwenden, ohne ihren Zustand vorher zu prüfen.
3. Den Worker-Build erstellen. Mit `node scripts/prepare-cloudflare-config.mjs <worker-name> <d1-name> <d1-uuid>` lässt sich aus dem Build die lokale Datei `dist/server/wrangler.nest.json` erzeugen. Der Befehl veröffentlicht nichts. Die Werte stammen aus dem eigenen Cloudflare-Konto. Die Build-Datei enthält nur Konfiguration und keine Zugangsdaten.
4. Einen Worker und eine Access-Anwendung einrichten. Die Access-Richtlinie muss sämtliche genutzten Adressen einschließlich `workers.dev` und etwaiger Vorschauadressen abdecken. Vorschau-URLs sind in der vorbereiteten Konfiguration deaktiviert. Auch die Infrastrukturkonfiguration muss vor der Nutzung mit echten Daten kontrolliert werden. Solange Access fehlt, ist die Oberfläche gegebenenfalls öffentlich erreichbar. Die Daten-API und der produktive Rezeptimport lehnen Anfragen ohne gültiges Token ab.
5. Am Worker serverseitig folgende Werte setzen: `NEST_ACCESS_TEAM_DOMAIN` als Cloudflare-Access-Team-Domain, `NEST_ACCESS_AUDIENCE` als Audience der Access-Anwendung und `NEST_ALLOWED_EMAILS` als kommaseparierte Liste der zwei zugelassenen Google-Adressen. Optional den vorhandenen `GEMINI_API_KEY` als Worker-Secret für den Rezeptimport setzen. Keine Werte in Quellcode oder Chat hinterlegen.
6. Erst nach Prüfung der Konfiguration bereitstellen und testen: Beide erlaubten Konten erhalten Zugang, ein anderes Konto und anonyme Anfragen nicht. Daten-API und Rezeptimport direkt prüfen. Anschließend die erste Übernahme anhand der README durchführen und Änderungen auf zwei Geräten ausprobieren.

Cloudflare Access kann mit Google-Konten eingesetzt werden. Die Zugangskontrolle vor dem Worker ersetzt nicht die zusätzliche signaturgeprüfte Autorisierung der Daten-API. Bei einer Änderung des Access-Teams, der Audience oder der E-Mail-Liste müssen die zugehörigen Worker-Werte aktualisiert werden.

## Grenzen der aktuellen Vorbereitung

- Der gemeinsame Datensatz ohne Bilder ist auf 1,5 MB begrenzt. Rezeptbilder werden getrennt in derselben D1-Datenbank gespeichert und bestehende eingebettete Bilder beim nächsten erfolgreichen Synchronisieren übernommen. Pro Bild sind höchstens 1.300.000 Zeichen als Data-URL und pro Synchronisation 30 neue Bilder möglich. Nicht mehr verwendete Bilddaten werden nicht automatisch entfernt.
- Bei konkurrierenden Änderungen gibt es eine Konfliktmeldung und Sicherung, aber keine automatische Zusammenführung.
- Ein Backup als JSON-Datei enthält auch die Bilder; beim Import sind maximal 50 MB möglich. Es ist kein automatischer externer Backup-Dienst eingerichtet.
- Google-Kalender ist nicht verbunden. Dafür wären später eigene Google-Berechtigungen und gegebenenfalls weitere Prüfungen nötig.
- Cloudflare-Free-Tier-Grenzen und mögliche Kosten für externe Dienste, insbesondere Gemini und gegebenenfalls R2, müssen bei der Einrichtung geprüft werden.

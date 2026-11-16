# Hinweise für die Weiterarbeit an Nuzzle

## Einstieg und Projektstand

Vor Änderungen `README.md`, `docs/architektur.md` und bei Veröffentlichungen `docs/deployment.md` lesen. Den Projektstand, lokale Änderungen und das Ziel vor jedem Eingriff prüfen und vorhandene Änderungen erhalten. Keine Zugangsdaten oder Haushaltsdaten in Dokumentation, Git, Ausgaben oder Logs übernehmen. Keinen Arbeits-GitHub-Account verwenden.

Dieses Projektverzeichnis ist die maßgebliche Arbeitskopie für Git, Weiterarbeit und Deployments. Vor Änderungen Git-Status und parallele Arbeiten prüfen; den gemeinsamen Index vor jedem Commit kontrollieren.

## Änderungen und Releases

- Dokumentation zusammen mit jeder betroffenen Änderung aktualisieren. Bei jedem Deployment und Release prüfen und anpassen: Version, Änderungen, Konfiguration, Betriebs- und Prüfhinweise sowie bekannte Grenzen. Nur nachweislich erfolgte Veröffentlichungen als veröffentlicht bezeichnen.
- Version in `package.json` und `package-lock.json` synchron nach Major.Minor.Patch pflegen. Die App liest die Paketversion. Eine neue veröffentlichte Änderung erhält eine neue Version. Bedeutende neue Funktionen erhöhen Minor, Bugfixes und kleine Anpassungen Patch, inkompatible grundlegende Änderungen Major; nachfolgende Stellen zurücksetzen.
- Build und zugehörige Tests ausführen. Push, Synchronisierung und Zugang auf echten Geräten gesondert prüfen, soweit möglich. Grenzen offen benennen.
- Die D1-Datenbank, vorhandene Secrets, Access-Schutz, Cron und Routen erhalten. Migrationen nie blind erneut auf produktive Daten anwenden. Vor Deployment `docs/deployment.md` beachten.
- Keine Remote- oder Produktionsänderungen ohne entsprechende Aufgabenstellung. Keine Zugangsdaten in Shell-Ausgaben oder Dateien außerhalb der vorgesehenen geheimen Konfiguration ausgeben.

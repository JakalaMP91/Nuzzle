# Nuzzle

## Lokales Git

Dieses Projektverzeichnis ist die maßgebliche Arbeitskopie für Weiterarbeit und Deployments. Es nutzt Git für die lokale Versionsverwaltung. Für parallele Codex- oder Claude-Code-Sitzungen vor Änderungen `git status` prüfen und Arbeiten an denselben Dateien abstimmen. Der Git-Index ist innerhalb einer Arbeitskopie gemeinsam: Vor einem Commit prüfen, welche Änderungen vorgemerkt sind, und keine fremden Änderungen ungeprüft committen. Für isolierte parallele Arbeit können separate Git-Worktrees verwendet werden. Git ersetzt keine separate Datensicherung.

## Projektdokumentation

Für Änderungen zuerst `AGENTS.md` und `docs/architektur.md` lesen. Der aktuelle Veröffentlichungsweg und die Betriebsprüfung stehen in `docs/deployment.md`; die Ersteinrichtung und Push-Details in `docs/cloudflare-einrichtung.md` und `docs/push-benachrichtigungen.md`. Der zuletzt veröffentlichte Stand wurde am 16.11.2026 in dieses Projektverzeichnis übernommen.


Lokale Vorschau einer Haushalts-App für Einkaufszettel, Rezepte und Aufgaben.
Nach `npm ci` startet `npm run dev` die Vorschau auf `http://localhost:5173/`.
Ohne eingerichteten gemeinsamen Speicher bleiben Eingaben lokal im Browser. Über „Lokal“ lassen sie sich als JSON-Datei sichern. Beim Neuladen erscheint die zuletzt gewählte Ansicht direkt nach einem kurzen Nuzzle-Startzustand; Home wird nicht mehr kurz eingeblendet. Das Ladesymbol zeigt zwei Bögen und ein Herz. Bei längerer Ladezeit schlägt das Herz sanft; bei reduzierter Bewegung bleibt das Symbol ruhig. Der Start wird für die Animation nicht künstlich verzögert. Die Detailseitenleisten öffnen mit einer kurzen Animation. Es ist kein privater GitHub-Account oder Remote erforderlich.

## Einstellungen und Versionierung

Unter „Farbschema“ kann auf diesem Gerät zwischen Nuzzle Grün und dem bisherigen Violett gewechselt werden. Die Auswahl wird lokal im Browser gespeichert.

Die Einstellungen sind über die Home-Kachel und das Kontosymbol erreichbar. Das Kontosymbol zeigt den erkannten Namen als Initiale; sein grüner beziehungsweise roter Rand zeigt den Sync-Status. Benachrichtigungen, Synchronisierung, Sicherung und Protokolldownload befinden sich in den Einstellungen.

Die angezeigte App-Version stammt aus package.json. Bei Fehlerkorrekturen und kleinen Anpassungen wird die Patch-Stelle erhöht, bei neuen Funktionen die Minor-Stelle und bei grundlegenden Änderungen die Major-Stelle. Nach einer Erhöhung werden die jeweils nachfolgenden Stellen auf null gesetzt. Der erste hier dokumentierte Stand ist 0.2.0. Versionsnummer und Lockdatei müssen bei jeder Veröffentlichung gemeinsam aktualisiert werden.

Einkaufsbenachrichtigungen können in den Einstellungen pro angemeldetem Gerät aktiviert werden und melden Aktionen der anderen erkannten Person. Neue Artikel und Einkäufe werden frühestens nach fünf Minuten gemeldet, sofern sie noch bestehen. Ein direkt nach dem Hinzufügen abgehakter Artikel erzeugt keine Einkaufsmeldung. Der Cron prüft jede Minute; die Zustellung kann sich darüber hinaus verzögern. Bereits vorhandene Änderungen vor Aktivierung werden nicht nachgemeldet.

## Benachrichtigungsprotokoll

In den Einstellungen kann auf jedem Gerät ein separates Benachrichtigungsprotokoll als JSON heruntergeladen werden. Es enthält App-Version, technischen Geräte- und Berechtigungsstatus, bis zu 150 lokale Ereignisse und, wenn das Gerät angemeldet und erreichbar ist, bis zu 100 zugehörige Server-Versandversuche. Gespeichert werden nur Ereignisart, Uhrzeit und gegebenenfalls technische Statuscodes. Aufgaben- und Artikelnamen, Push-Endpunkte, Schlüssel und Kontonamen gehören nicht in den Export. Die lokalen Einträge liegen im Browser und können beim Löschen der Website-Daten verloren gehen. Servereinträge werden bei der regulären Bereinigung nach 30 Tagen entfernt. Versand und Empfang sind nur ab der jeweiligen Aufzeichnung sichtbar; die erfolgreiche Anzeigeanforderung beweist nicht, dass ein Mensch die Benachrichtigung gesehen hat.

## Sync-Protokoll

In den Einstellungen unter „Synchronisierung und Sicherung“ lässt sich das Sync-Protokoll als JSON herunterladen. Es liegt nur im Speicher des jeweiligen Browsers und enthält höchstens die letzten 200 technischen Ereignisse: UTC-Zeit nach Geräteuhr, Vorgang, Ergebnis, Fehlerklasse, gegebenenfalls HTTP-Status, Revisionsnummern, einen groben Konfliktbereich, Dauer und den vom Browser gemeldeten Online-Status. Es enthält keine Haushaltsinhalte, Zugangsdaten oder Server-Fehlermeldungen und wird nicht automatisch übertragen. Bei Problemen das Protokoll auf dem betroffenen Gerät herunterladen. Ereignisse vor dieser Funktion sind nicht verfügbar; serverseitige Ursachen lassen sich damit nicht immer bestimmen. Wird der Browserspeicher blockiert oder gelöscht, ist das Protokoll nur während der laufenden Sitzung beziehungsweise nicht mehr verfügbar. `node --experimental-strip-types --test lib/sync-log.test.mjs` prüft Begrenzung, Fehlerklassifizierung und Speicherfehler.

## Aufgaben

Aufgaben können im Board, auf der Startseite und in den Details erledigt werden. Der Hinweis bietet kurz eine Rücknahme; im standardmäßig geschlossenen Archiv lassen sie sich später wiederherstellen. Fehlt der frühere Bereich, wird „Unbekannt“ angelegt. Bei älteren Einträgen wird „Ich“ als Markus und „Partner“ als Bettina angezeigt.

Ab Version 0.6.0 melden aktivierte Aufgabenbenachrichtigungen neue Kommentare auf den Geräten des jeweils anderen Kontos, unabhängig von der Aufgabenzuordnung. Die App synchronisiert Kommentare beim Verlassen der Aufgabe; der nächste Cron-Lauf erfolgt üblicherweise innerhalb einer Minute. Nur Kommentare aus der aktualisierten App werden berücksichtigt. Aufgabenkacheln zeigen die Zahl der Kommentare und Bilder sowie ungelesene Kommentare. Als gelesen gilt ein Kommentar, sobald die Aufgabe auf diesem Gerät geöffnet wurde; eigene Kommentare zählen nicht als neu. Der Lesestatus wird nur auf diesem Gerät gespeichert. Aufgaben unterstützen optionale Priorität, Datum mit Uhrzeit, Beschreibung, mehrere Bilder und Kommentare. Der Kommentarautor wird aus der geprüften Cloudflare-Anmeldung ermittelt. Änderungen und ein angefangener Kommentar werden beim Verlassen der Aufgabe übernommen; die gemeinsame Synchronisierung erfolgt anschließend. Ist das Konto nicht eindeutig zugeordnet, sind neue Kommentare gesperrt. Eine Kalenderanbindung ist nicht eingerichtet. Aufgaben haben einen wählbaren Erinnerungsvorlauf (Standard: zum Termin), orange Markierungen ausschließlich am Fälligkeitstag und rote Überfälligkeitsmarkierungen auf Home, Board und in der Terminansicht. Vor dem Fälligkeitstag bleiben Aufgaben farblich neutral; der gewählte Push-Vorlauf ist davon unabhängig. Die Erledigen-Kreise sind in allen Ansichten zunächst leer. Termine gelten in Europe/Berlin. Ohne Uhrzeit bleibt die Aufgabe bis Tagesende offen; die Benachrichtigung erfolgt standardmäßig um 08:00 Uhr und kann pro Gerät in den Einstellungen angepasst werden. In den Einstellungen lassen sich Web-Push-Benachrichtigungen pro Gerät aktivieren, testen und deaktivieren. Beim Start wird eine vorhandene Geräteanmeldung wiederhergestellt; ein vorübergehender Prüfungsfehler wird getrennt von einer Deaktivierung angezeigt. Neue Aufgaben mit bekannter Autorenzuordnung lösen beim anderen zuständigen Konto oder bei gemeinsamen Aufgaben eine Push-Nachricht aus, auch ohne Termin. Der Prüfintervall beträgt eine Minute. Zwischen Testnachrichten auf demselben Gerät liegt eine Minute; die Berechtigung wird ausschließlich per Klick angefragt. Eigene und gemeinsame Aufgaben erzeugen höchstens eine Vorwarnung und eine Fälligkeitsnachricht je Termin und Gerät. Einrichtung und Grenzen stehen in `docs/push-benachrichtigungen.md`. Bilder sind Teil der JSON-Sicherung.

Einkaufsposten können in ihren Details mit „Immer da“ versehen oder daraus entfernt werden. Die Änderung wird mit dem Einkaufsposten gespeichert und betrifft den exakt passenden Produktnamen.

„Häufig verwendet“ zeigt Artikel, die mindestens zweimal abgehakt wurden, nach Anzahl der Einkäufe und bei Gleichstand nach dem jüngsten Einkauf. Namen werden ohne Beachtung von Großschreibung und mehrfachen Leerzeichen zusammengefasst; abweichende Namen bleiben getrennt. Die gespeicherte Einkaufshistorie beider Konten bildet die Grundlage. Bearbeitete Vorschläge werden separat gespeichert.

„Zuletzt verwendet“ ist nach dem Einkaufsdatum absteigend gruppiert: Heute, Gestern, Vorgestern, vor 3 bis 14 Tagen und vor über zwei Wochen. Die Kalendertage gelten in Europe/Berlin. Neue Einkäufe speichern ihren Zeitpunkt; bei älteren Einträgen wird ein plausibler Zeitstempel in der ID verwendet, sonst erscheint „Datum unbekannt“. Vorschläge unter „Zuletzt verwendet“, „Häufig verwendet“, „Immer da“ und „Lange nicht gekauft“ lassen sich über das Stiftsymbol bearbeiten, ohne sie auf den Einkaufszettel zu setzen. Ein langer Druck und Loslassen öffnet ebenfalls die Bearbeitung.

In den Rezeptdetails scrollen Bild, Titel und Beschreibung mit dem Rezeptinhalt mit. Neue fremde Rezepte mit bekanntem Urheber stehen beim ersten Besuch der Rezeptseite oben unter „Neu“. Beim nächsten Besuch oder Neuladen werden sie regulär einsortiert. Die Vorstellung wird auf dem Gerät gemerkt; eigene Rezepte und ältere Rezepte ohne bekannten Urheber erhalten keinen Neu-Hinweis. Alphabetische und chronologische Sortierung (neueste zuerst) werden auf dem Gerät gespeichert. Die Einteilung der Rezepte erfolgt ausschließlich über die frei verwaltbaren normalen Kategorien. Auch „Ausprobieren“ oder „Bewährt“ lassen sich bei Bedarf als normale Kategorien anlegen. Bei älteren Rezepten ohne Anlagedatum bleibt die chronologische Reihenfolge untereinander erhalten; numerische Zeitstempel-IDs werden berücksichtigt. Favoriten bleiben erhalten.

Die Navigation zeigt auf jedem Gerät separat die Zahl neuer gemeinsamer Einkaufsposten, abgeschlossener Einkäufe und Aufgaben, neuer Aufgabenkommentare und Aufgabenbilder sowie neuer Rezepte seit der letzten Synchronisierung. Home zeigt zusätzlich die Namen der bis zu vier zuletzt hinzugekommenen oder erledigten Einkaufsposten und Aufgaben pro Art. Nur Änderungen des jeweils anderen angemeldeten Nutzers erzeugen Hinweise. Ältere Einträge ohne eindeutig erkennbaren Urheber werden vorsichtshalber nicht als neu markiert. Beim Öffnen eines Bereichs werden dessen Hinweise zurückgesetzt. Neue Einkaufsposten tragen beim ersten Besuch eine Schärpe und verlieren sie spätestens beim nächsten Besuch der Einkaufsliste. Beim ersten Verbinden gelten vorhandene Daten nicht pauschal als neu. Die Hinweise werden nur auf dem jeweiligen Gerät gespeichert.

Die Einkaufsliste bietet eigene, chronologische und alphabetische Reihenfolge; die zuletzt gewählte Sortierung bleibt auf dem Gerät gespeichert. Artikel ohne erkennbares Anlagedatum behalten in der chronologischen Ansicht untereinander ihre bisherige Reihenfolge. Aktive Einkaufsposten sind grün, Kacheln in Vorschlagsbereichen rosé dargestellt, unabhängig vom Produktnamen.

In der Rezeptansicht lässt sich bei Rezepten mit hinterlegter Portionszahl die Menge vorübergehend anpassen. Erkennbare Mengen am Anfang der Zutatenangaben werden umgerechnet, auch in der Einkaufsauswahl und bei den zugeordneten Zubereitungsschritten. Nicht erkennbare Angaben und Freitext in Anleitungen bleiben unverändert. Beim erneuten Öffnen gilt wieder die im Rezept gespeicherte Portionszahl.

Kacheltitel verwenden normale Wortgrenzen und die deutsche Silbentrennung des Browsers. URLs und längere Freitextkommentare dürfen als Überlaufschutz umbrochen werden. Die verfügbare Silbentrennung hängt vom Browser ab.

Auf Wunsch ist die Zoomgeste über den Viewport eingeschränkt. Die tatsächliche Wirkung hängt vom Browser und dessen Bedienungshilfen ab.

## Installation auf dem Smartphone

Nuzzle stellt ein Web-App-Manifest im eigenständigen App-Modus bereit, damit Android seine Systemleisten anzeigen kann. Nach der Anmeldung kann die Seite über das Browsermenü als App installiert werden. Der Browser bestimmt die tatsächliche Darstellung; bei der Anmeldung über Cloudflare oder Google können Browserleisten erscheinen. Eine bereits zuvor angelegte Verknüpfung muss gegebenenfalls nach dem Update neu installiert werden. Vor dem Entfernen einer alten Installation den gemeinsamen Speicher auf „Gemeinsam“ prüfen und gegebenenfalls eine lokale Sicherung herunterladen. Es gibt keine Offline-Zusage.

## Gemeinsame Daten und Cloudflare

Die vorbereitete Anbindung speichert Einkaufsdaten, Aufgaben und Rezepte gemeinsam in einer D1-Datenbank. Eine Cloudflare-Access-Anwendung muss den gesamten Worker einschließlich aller Vorschauadressen schützen. Der Datenendpunkt prüft zusätzlich bei jeder Anfrage das signierte Access-Token, dessen Aussteller und Audience sowie eine serverseitige Liste zugelassener E-Mail-Adressen. Der Rezeptimport prüft dies im produktiven Build ebenfalls. Die Google-Anmeldung wird in Cloudflare Access und in der Google Cloud Console eingerichtet, nicht durch ein eigenes Passwortsystem in Nuzzle.

Der gemeinsame Speicher ist erst nach Einrichtung und Prüfung der externen Dienste nutzbar. Die ausführliche Reihenfolge steht in `docs/cloudflare-einrichtung.md`. Ein Tunnel ist für einen direkt bei Workers betriebenen Dienst nicht nötig.

Die erste Übernahme erfolgt ausdrücklich über den Dialog „Lokal“. Daten aus der lokalen Vorschau sind wegen unterschiedlicher Browser-Ursprünge auf der Cloud-Adresse nicht direkt sichtbar: In der Vorschau zuerst „Lokale Sicherung herunterladen“ wählen, die Datei in der Cloud-App laden und anschließend in den leeren gemeinsamen Speicher übernehmen. Vor dem Laden gemeinsamer Daten erstellt Nuzzle eine zusätzliche Sicherung im lokalen Browser.

Änderungen werden nach kurzer Verzögerung gespeichert. Aktive Geräte prüfen etwa alle 15 Sekunden, beim Zurückkehren und beim Wechsel der App-Bereiche auf neue Daten. Vor dem Öffnen vorhandener Aufgaben und Einkaufsposten wird nach Möglichkeit ebenfalls aktualisiert. Solange ein Editor geöffnet ist oder lokale Änderungen noch nicht gespeichert sind, werden fremde Daten nicht über offene Eingaben geladen. Bei vorübergehenden Verbindungsfehlern erscheint ein Warnbanner und Nuzzle versucht die Verbindung erneut. Ist die Cloudflare-Sitzung abgelaufen, weist das Banner auf die erforderliche Anmeldung hin und bietet einen Knopf zur erneuten Anmeldung. Nach gleichzeitigen Änderungen werden unabhängig geänderte Aufgabenfelder oder verschiedene Aufgaben anhand des gemeinsamen Ausgangsstands automatisch zusammengeführt. Unabhängige Ergänzungen in Einkaufslisten und Vorschlägen sowie Änderungen an Einkauf und Rezepten lassen sich ebenfalls zusammenführen. Bei gleichzeitigem Löschen, Bearbeiten oder widersprüchlicher Sortierung im Einkaufsbereich bleibt Nuzzle vorsichtig und meldet einen Konflikt. Auch Aufgabenänderungen und unabhängige Einkaufs- oder Rezeptänderungen lassen sich zusammenführen. Bei konkurrierenden Änderungen am selben Feld, Löschkonflikten und anderen nicht eindeutig auflösbaren Änderungen bleibt die Synchronisierung angehalten und die lokalen Daten bleiben erhalten. Im Konfliktdialog können die Daten gesichert und die Verbindung erneut geprüft werden. Vor dem Ersetzen lokaler Änderungen durch den gemeinsamen Stand fragt Nuzzle ausdrücklich nach und erstellt zusätzlich eine lokale Sicherung. Rezept- und Aufgabenbilder werden getrennt in derselben D1-Datenbank gespeichert; bereits eingebettete Bilder werden beim nächsten erfolgreichen Synchronisieren übernommen. Der Datensatz ohne Bilder bleibt auf 1,5 MB begrenzt, ein Bild auf 1.300.000 Zeichen als Data-URL und ein Synchronisationsvorgang auf 30 neue Bilder. Der verfügbare Speicher richtet sich nach dem Cloudflare-Tarif. Eine JSON-Sicherung enthält auch die Bilder; beim Import sind maximal 50 MB möglich. Nicht mehr verwendete Bilddaten werden derzeit nicht automatisch entfernt.

Die Zurück-Funktion des Browsers oder Smartphones schließt die zuletzt geöffnete Ansicht beziehungsweise den zuletzt geöffneten Dialog. Auf der Startseite bleibt Nuzzle geöffnet.

Technische Prüfungen: `node --experimental-strip-types --test lib/household-security.test.mjs lib/household-concurrency.test.mjs lib/household-service.test.mjs lib/household-images.test.mjs`. Die Tests ersetzen keine Prüfung einer echten Access-Konfiguration oder den Test auf mehreren Geräten.

Produkt-Icons werden anhand deutscher Artikelnamen zugeordnet. Das gilt auch für bereits lokal gespeicherte Posten und für Rezeptzutaten. Unbekannte Namen erhalten ein neutrales Paket-Icon. Im Einkaufsposten-Editor öffnet ein Tipp auf das Icon die nach Produktgruppen sortierte Auswahl mit einzelnen Lebensmitteln und allgemeinen Auffang-Icons für Obst und Gemüse. Die Auswahl gilt für Produkte gleichen Namens appweit und wird mit den Haushaltsdaten synchronisiert. Auch bestehende Rezeptzutaten übernehmen sie. In Rezepten lässt sich die Auswahl durch langes Drücken oder Anklicken des Zutaten-Icons öffnen; „Automatisch“ setzt die Zuordnung zurück. Die Symbole sind farbig und gefüllt; für Brötchen, Zucchini, Frühlingszwiebeln, Wurst, Salami und Schinken liegen Bilddateien unter `public/product-icons/`. Der Katalog enthält außerdem eigene Piktogramme für Salz, Pfeffer, Gewürze, Kräuter sowie typische Backzutaten; spezifische Regeln unterscheiden beispielsweise Paprikapulver von Paprika und Speisesalz von Spülsalz. Eigene Symbole unterscheiden Scheibenkäse, Hartkäse, Weichkäse, Frischkäse, körnigen Frischkäse, Mozzarella oder Burrata und Feta. Dazu kommen Symbole für Haferflocken, Zwieback und Tomatenmark sowie eigene SVGs für Himbeeren, Brombeeren, Muskat, Vanille, Pflaumen/Zwetschgen und Spargel. Parmesan, Pecorino, Pancetta und Guanciale werden anhand ihres Namens erkannt. Das Erscheinungsbild der übrigen Emoji-Piktogramme kann je nach Gerät leicht variieren. Katalog und Regeln liegen in `lib/product-icon.ts`; `node --experimental-strip-types --test lib/product-icon.test.mjs` prüft typische Beispiele.

## Rezeptimport und Zubereitung

In der Rezeptansicht öffnet ein Klick auf das Titelbild eine bildschirmfüllende Ansicht des vollständigen Bildes. Ein weiterer Klick, Escape oder die Zurück-Funktion schließt sie und zeigt wieder das Rezept. Das elastische Überziehen an den Scrollrändern wird in unterstützten Browsern unterdrückt; die Seitenabstände am unteren Rand sind angeglichen.

Beim erneuten Öffnen von „Rezept hinzufügen“ sind Link, Text und ausgewählte Dateien leer. Ein beim Schließen noch laufender Import wird abgebrochen.

Rezepte können Zutaten und geordnete Zubereitungsschritte enthalten. Zutaten lassen sich einzelnen Schritten zuordnen. In der Rezeptansicht steht die Zutatenliste über einer tabellarischen Zubereitungsübersicht. Ältere Rezepte ohne Schritte zeigen weiterhin ihre Zutaten. Der manuelle Editor öffnet sich als große Seitenansicht mit eigener Scrollfläche. Vorhandene Zutaten lassen sich dort direkt bearbeiten, ohne ihre Zuordnung zu Zubereitungsschritten zu verlieren. Schritte lassen sich hinzufügen, ändern, umsortieren und löschen. Dauer und Portionen können unbekannt bleiben; dann erscheinen sie weder auf der Rezeptkachel noch in der Detailansicht.

Rezeptkacheln und Rezeptdetails zeigen die Quelle. Bei importierten Website-Rezepten ist der Domainname direkt mit der Originalseite verlinkt. Bild- und Textimporte tragen die Angaben „Bilder“ beziehungsweise „Text“, manuell angelegte Rezepte „Manuell“. Die Herkunft bleibt beim späteren Bearbeiten erhalten. Bei älteren lokal gespeicherten Rezepten ohne Herkunftsangabe wird „Manuell“ angezeigt.

Ein Schritt kann ein benanntes Ergebnis wie „Teig“ erzeugen. Dieses Ergebnis steht in späteren Schritten als wählbare Eingabe bereit und wird in deren Zutaten-Spalte vor den übrigen Zutaten angezeigt. Das neu erzeugte Ergebnis erscheint in der Tabelle unter der Arbeitsanweisung. Zeitangaben wie „5 Min.“ oder „1–2 Minuten“ sind dort hervorgehoben. Der KI-Import versucht, ausdrücklich genannte Zwischenergebnisse und ihre Verwendung zu verknüpfen. Im Rezepteditor lassen sich gespeicherte Rezepte nach Bestätigung löschen. Hochgeladene Rezeptfotos werden vor dem Übernehmen in einer verschiebbaren und vergrößerbaren 3:4-Vorschau zugeschnitten; die Übersichtskacheln behalten unabhängig vom Bildformat ihre Größe.

Bei URL-Importen liest Nuzzle zusätzlich das Titelbild aus den Schema.org-Rezeptdaten oder ersatzweise aus `og:image` beziehungsweise `twitter:image`. Abrufbar sind nur HTTPS-Bilder von zulässigen Hostnamen im Format JPG, PNG oder WebP bis 4 MB. Das Bild wird nicht automatisch gespeichert: Im Rezepteditor lässt es sich über „Titelbild der Quelle übernehmen“ prüfen, zuschneiden und anschließend mit dem Rezept speichern. Ist kein geeignetes Bild abrufbar, bleibt der Rezeptimport möglich und ein eigenes Foto kann weiterhin hochgeladen werden. Bei fotografierten Rezepten soll die KI aufeinanderfolgende Zutatenzeilen dem direkt folgenden Verarbeitungsschritt gemeinsam zuordnen; mit „+“ oder „&“ verbundene Lebensmittel bleiben eigene Zutaten, durchgestrichene werden nicht als verwendet übernommen. Eine Nachverarbeitung trennt verbliebene Plus-Einträge, erhält ihre Schritt-Zuordnung und addiert konkrete Mehrfachmengen derselben Zutat. g/kg, ml/l und EL/TL werden innerhalb ihrer Einheitengruppe umgerechnet; andere Einheiten bleiben explizite Summen wie „5 EL + 20 g“. Optionale Zusatzmengen bleiben getrennt. Ausgewiesene Gesamtmengen und bloße Wiederholungen in Arbeitsschritten werden nicht nochmals addiert. Ursprüngliche Teilmengen stehen an den jeweiligen Schritten und sind im Editor korrigierbar. Fehlt eine verlässliche Teilmenge bei mehrfacher Verwendung, zeigt Nuzzle „Teilmenge siehe Anleitung“, statt die Gesamtmenge mehrfach auszugeben. Teilmengen und explizite Summen werden mit der Portionszahl skaliert; `node --experimental-strip-types --test lib/recipe-import-ingredients.test.mjs` prüft dies. Ausdrücklich erst im Arbeitsschritt genannte Zutaten werden ohne erfundene Menge ergänzt und mit einem kurzen Verwendungshinweis versehen. `node --experimental-strip-types --test lib/recipe-extract.test.mjs` prüft die Metadaten-Erkennung.

In der geöffneten Rezeptansicht füllt ein mittiger Bildausschnitt die gesamte Breite der Seitenleiste. Klare Zutatenalternativen in strukturierten Website-Daten, zum Beispiel „Pancetta oder Guanciale“ und „alternativ Bauchspeck“, werden nach der KI-Erkennung zusätzlich in wählbare Rezeptversionen überführt. So bleiben sie nicht nur als Freitext an einer Zutat hängen. Die Varianten werden mit `node --experimental-strip-types --test lib/recipe-alternatives.test.mjs` geprüft.

Der Knopf „KI-Bild erstellen“ ist vorerst ein deaktivierter Platzhalter. Die bestehende `GEMINI_API_KEY`-Variable kann später auch für ein Bildmodell verwendet werden, sofern das zugehörige Google-Projekt aktiven Bildmodell-Zugriff und Abrechnung hat. Für die aktuellen Gemini-Bildmodelle weist Google keinen Free Tier in der API aus. Nuzzle löst dafür aktuell keinen kostenpflichtigen Aufruf aus.

Auf breiten Rezeptansichten stehen Zutaten innerhalb eines Zubereitungsschritts zu zweit nebeneinander. Auf Handys stehen Eingaben und Anweisung untereinander. Rezeptversionen, Zutaten und Zubereitung sind im Editor einklappbar; ihr Zustand wird lokal gespeichert. Die Seitenansichten für Rezepte, Einkaufsposten und Aufgaben nutzen auf dem Desktop mehr Breite. Einkaufszettel und Aufgabenboard verwenden nahezu die gesamte verfügbare Desktop-Breite: Einkaufskacheln bilden automatisch zusätzliche Spalten, Aufgabenbereiche wachsen mit dem Platz. Weitere Aufgabenbereiche bleiben in einer horizontal scrollbaren Reihe mit dezenter Scrollleiste. Auf Mobilgeräten stehen die Bereiche untereinander und Einkaufskacheln weiterhin zu dritt. Auf Touchgeräten öffnet langes Halten und Loslassen eines Einkaufspostens dessen Bearbeitung; nach dem Halten kann er weiterhin gezogen werden. Auf Touchgeräten werden Aufgaben durch Halten und Ziehen der Karte verschoben. Ein sofortiges Wischen über die Karte scrollt mit Nachlauf. Mit Alt und Pfeiltasten lassen sich Einkaufsposten und Aufgaben innerhalb ihres Bereichs verschieben. Beim Ziehen einer Aufgabe kann das Desktop-Board am linken oder rechten Rand weiterscrollen. Auf der Startseite stehen die nächsten Aufgaben mit Termin.

„Zutaten einkaufen“ zeigt benötigte Zutaten als ausgewählte, innerhalb des Rasters gleich hohe Kacheln. Optionale und als „Immer da“ markierte Zutaten stehen zunächst in eigenen aufklappbaren Bereichen und können per Tipp übernommen werden. Ausgewählte Zutaten lassen sich wieder abwählen. Vor der Übernahme öffnet der unten rechts angeordnete Stift auf jeder Zutatenkachel die bekannten Postenparameter; dafür bleibt auch bei längeren Hinweisen Platz frei. Änderungen betreffen zunächst nur den geplanten Einkauf, nicht das Rezept. Erkennbare Mengen samt Einheit werden übernommen, etwa `500 g`, `1,5 l`, `2 EL` oder `1 Päckchen`. Mehrdeutige Angaben bleiben als Freitext erhalten. Der Rezepteditor bietet getrennte Felder für Menge, Einheit und weitere Angaben; alte und importierte Zutatenangaben werden beim Bearbeiten soweit möglich aufgeteilt. Die Regeln liegen in `lib/recipe-quantity.ts` und werden mit `node --experimental-strip-types --test lib/recipe-quantity.test.mjs` geprüft. Im Einkaufszettel stehen ein freies Mengenfeld und die Vorauswahl `1`, `2`, `6`, `10`, `50`, `100`, `250` und `500` bereit. Neue Artikel lassen sich im Produktfeld per Enter oder mit dem Plusknopf daneben direkt hinzufügen. Die Typenauswahl ist vollständig sichtbar, ohne eigenen Scrollbalken. Alle abgehakten Posten landen unter „Zuletzt verwendet“, einschließlich Rezeptzutaten. Bereits im früheren Bereich „Aus Rezepten“ gespeicherte Vorschläge bleiben dort zusammen mit den übrigen sichtbar und bearbeitbar; die gemeinsame Datenstruktur bleibt kompatibel. Ein Tipp holt sie ohne Rezeptzuordnung auf die Liste zurück. Nur direkt aus einem Rezept hinzugefügte Zutaten zeigen dessen Namen.

Exakte Namen auf dem Einkaufszettel werden als „Schon auf Liste“ markiert; bei ähnlichen deutschen Produktnamen, Pluralformen oder einem kleinen Tippfehler nennt ein Hinweis den vorhandenen Posten. Das ist nur ein Hinweis, kein automatisches Zusammenführen. Die Vergleichsregeln liegen in `lib/shopping-similarity.ts` und werden mit `node --experimental-strip-types --test lib/shopping-similarity.test.mjs` geprüft. Varianten sind vollständige Rezeptversionen mit eigener Zutatenliste und eigenen Schritten. Sie lassen sich im Editor anlegen, umbenennen, bearbeiten und löschen. In der Rezeptansicht können mehrere Varianten gewählt werden, wenn sie unterschiedliche Zutaten und Zubereitungsschritte ändern. Bei einer Überschneidung wechselt die Auswahl zur zuletzt angetippten Variante. Die Einkaufsauswahl folgt der Kombination. Die Prüfung liegt in `lib/recipe-versions.ts`; `node --experimental-strip-types --test lib/recipe-versions.test.mjs` testet typische Kombinationen und Konflikte. Bisherige reine Zutatenvarianten aus lokalen Daten werden beim Laden in Versionen überführt. Anschließend werden nur die ausgewählten Kacheln als einzelne Posten übernommen. Auf schmalen Bildschirmen stehen zwei Rezeptkacheln nebeneinander. Bei Dauer und Portionen sitzt das Zurücksetzen oberhalb des Eingabefelds, sodass dessen Breite unverändert bleibt.

Die „Immer da“-Produktliste lässt sich im Einkaufszettel bearbeiten und wird lokal gespeichert. Beim KI-Import werden passende Zutaten, einschließlich naheliegender Namensvarianten wie „Vollmilch“ zu „Milch“, automatisch markiert. Die Markierung eines bereits gespeicherten Rezepts bleibt bis zur manuellen Bearbeitung unverändert.

Auch beim manuellen Erfassen schlägt Nuzzle für eine neu eingegebene Zutat die „Immer da“-Markierung anhand der bekannten Produkte vor. Längere Namen wie „Salz aus der Mühle“ oder „schwarzer Pfeffer“ werden erkannt, ohne beliebige Wortteile wie „Salz“ in „Salzstangen“ gleichzusetzen. Die Markierung kann im Editor weiterhin geändert werden. Der Abgleich liegt in `lib/pantry-match.ts` und wird mit `node --experimental-strip-types --test lib/pantry-match.test.mjs` geprüft.

Beim KI-Import werden fremdsprachige Rezepte in allen sichtbaren Feldern auf Deutsch übertragen und offensichtliche Rechtschreib- und Grammatikfehler behutsam korrigiert. Eigenständige, auch im Deutschen gebräuchliche Zutatennamen wie Bacon, Pancetta oder Guanciale sollen erhalten bleiben und nicht pauschal als „Speck“ erscheinen. Mengen, Zeiten, Zutaten, Reihenfolge und Bedeutung sollen dabei erhalten bleiben. Unbekannte Dauer und Portionenzahl werden nicht erfunden. Erkennbare Alternativfassungen können als vollständige Versionen mit eigenen Zutaten und Schritten übernommen werden; das Ergebnis bleibt vor dem Speichern überprüfbar.

Für die Erkennung von Rezeptlinks, kopiertem Rezepttext, Rezeptfotos oder PDFs wird Gemini 3.5 Flash-Lite verwendet. Einen eigenen Gemini-API-Schlüssel als `GEMINI_API_KEY=...` in `.env.local` im Projektverzeichnis hinterlegen und den lokalen Server neu starten. `.env.local` ist ignoriert und darf nicht in Git eingecheckt werden. Bilder müssen JPG, PNG oder WebP sein. Bis zu vier Bilder oder PDFs dürfen zusammen höchstens 7 MB groß sein. Link, Text und ausgewählte Dateien werden erst beim Klick auf „Rezept erkennen“ verarbeitet und an Google gesendet. Bei HTTPS-Rezeptseiten lädt Nuzzle zunächst höchstens 2 MB HTML und extrahiert, sofern vorhanden, den kompakten Schema.org-Rezeptblock mit Zutaten und Schritten. Nur diese Daten gehen dann an Gemini; Werbung und übrige Seitentexte bleiben außen vor. Fehlt ein brauchbarer Block oder scheitert der Abruf, nutzt Nuzzle weiterhin Gemini URL Context. Seiten mit Anmeldung oder Bezahlschranke können scheitern. Ein Link kann auch allein in das Textfeld eingefügt werden. Die Quelle bleibt am importierten Rezept verlinkt. Das erkannte Rezept öffnet sich zunächst im Editor und wird erst nach manueller Prüfung und Speichern übernommen. Metrische Mengen werden nach Möglichkeit in die Mengenfelder übertragen; Zutaten und ihre Zuordnung zu Arbeitsschritten sollten überprüft werden. Ohne Schlüssel bleiben manuelles Anlegen und Bearbeiten nutzbar.

## Technischer Unterbau

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Whenever reopening or moving a checkout, run `node <plugin-root>/scripts/configure-execution-profile.mjs` before project commands. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)



# Nuzzle-Design

Das Nuzzle-Design umfasst das grüne Icon mit korallfarbenem Herz, den animierten Ladebildschirm und ein darauf abgestimmtes Farbschema. Das Schema liegt getrennt in `app/nuzzle-theme.css`. Farben für Fehler, Fälligkeiten und individuell gewählte Aufgabenbereiche behalten ihre Bedeutung.

Die ursprüngliche hochaufgelöste PNG-Vorlage liegt in `assets/nuzzle-icon-original.png`. Die installierbare App verwendet die 192- und 512-Pixel-Fassungen; für iOS ist zusätzlich eine 180-Pixel-Fassung eingebunden. Das Favicon und die Ladeanimation sind skalierbare, unabhängig nachgezeichnete Vektorfassungen des Motivs. Browser und Betriebssysteme entscheiden, wann bestehende Installationen ihre Icons aktualisieren.

Die Bögen des Ladebildschirms gleiten einmal über zwei Sekunden ein. Bei längerer Ladezeit pulsiert das Herz; bei reduzierter Bewegung bleibt das Symbol ruhig. Der tatsächliche App-Start wird nicht verzögert, weshalb die Animation auf schnellen Geräten nur kurz sichtbar sein kann.

Unter „Einstellungen → Farbschema“ kann zwischen Nuzzle Grün und dem bisherigen Violett gewechselt werden. Die Auswahl wird unabhängig von den Haushaltsdaten pro Browser gespeichert. Wenn der Browserspeicher nicht verfügbar ist, gilt die Auswahl nur bis zum Neuladen. Beim Wechsel werden passende Browser-Icons, Manifeste und der Ladebildschirm ausgewählt. Bereits installierte Apps übernehmen ein neues Icon möglicherweise erst verzögert oder nach erneuter Installation; die Entscheidung liegt beim Betriebssystem. Push-Benachrichtigungen verwenden weiterhin das grüne Icon.

Vor einer Veröffentlichung Darstellung, Kontraste und die Aktualisierung des Icons auf den betroffenen Geräten prüfen.

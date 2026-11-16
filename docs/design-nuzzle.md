# Nuzzle-Design

Der Design-Branch bereitet das grüne Icon mit korallfarbenem Herz, den bereits implementierten Ladebildschirm und ein darauf abgestimmtes Farbschema vor. Das Schema liegt getrennt in `app/nuzzle-theme.css`, damit es beim Zusammenführen mit anderen Oberflächenänderungen überprüft und angepasst werden kann. Farben für Fehler, Fälligkeiten und individuell gewählte Aufgabenbereiche behalten ihre Bedeutung.

Die ursprüngliche hochaufgelöste PNG-Vorlage liegt in `assets/nuzzle-icon-original.png`. Die installierbare App verwendet die 192- und 512-Pixel-Fassungen; für iOS ist zusätzlich eine 180-Pixel-Fassung eingebunden. Das Favicon und die Ladeanimation sind skalierbare, unabhängig nachgezeichnete Vektorfassungen des Motivs. Browser und Betriebssysteme entscheiden, wann bestehende Installationen ihre Icons aktualisieren.

Die Bögen des Ladebildschirms gleiten einmal über zwei Sekunden ein. Bei längerer Ladezeit pulsiert das Herz; bei reduzierter Bewegung bleibt das Symbol ruhig. Der tatsächliche App-Start wird nicht verzögert, weshalb die Animation auf schnellen Geräten nur kurz sichtbar sein kann.

Dieser Branch ist ein lokaler Vorschlag und keine Veröffentlichung. Vor dem Merge die parallelen Änderungen, insbesondere an `app/layout.tsx`, `public/manifest.webmanifest` und `public/sw.js`, prüfen. Danach Darstellung und Kontraste mit dem tatsächlich zusammengeführten Stand erneut prüfen.

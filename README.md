# St. Martin

Liedtexte-Website für den ökumenischen St. Martinszug in Bochum-Linden.

## Lokal starten

Node.js 18 oder neuer wird benötigt. Setze das Admin-Passwort beim Start über die Umgebungsvariable `ADMIN_PASSWORD`:

```powershell
$env:ADMIN_PASSWORD = "dein-passwort"
node server.js
```

Die Website ist dann unter <http://localhost:4173> erreichbar. Die Upload-Seite unter `admin.html` ist per HTTP-Basic-Authentifizierung geschützt. Benutzername: `admin`; verwende als Passwort den gewünschten Zugang. Für den hier vorgesehenen Zugang setze `ADMIN_PASSWORD` auf das vereinbarte Passwort.

## Lieder veröffentlichen

1. Öffne das Impressum und klicke im Footer auf **Upload**.
2. Wähle eine textbasierte PDF-Datei aus. Lieder werden anhand größerer, fetter Überschriften getrennt; gescannte PDFs werden nicht per OCR erkannt.
3. Lade den Liedkatalog `songs.json` und für jedes erkannte Lied die `.txt`-Datei herunter.
4. Lege die Lieddateien als `.txt` in `texte/`.
5. Starte `aktualisiere-lieder.bat` per Doppelklick. Die BAT-Datei erstellt `texte/songs.js` aus allen Liedtexten.
6. Öffne `index.html` direkt oder lade die aktualisierte Website hoch.

Die BAT-Datei benötigt Windows PowerShell, das auf Windows normalerweise bereits installiert ist. Beim Start mit `node server.js` wird die Liedliste direkt aus allen `.txt`-Dateien in `texte/` gelesen. Die PDF wird im Browser verarbeitet und nicht auf den Server hochgeladen. Die PDF.js-Bibliothek für diese Verarbeitung wird von cdnjs geladen. Bei öffentlichem Betrieb sollte die Website über HTTPS erreichbar sein.

Die Seiten `impressum.html` und `datenschutz.html` enthalten die bereitgestellten Trägerangaben. Bitte vor der Veröffentlichung die Angaben zur zuständigen kirchlichen Datenschutzaufsicht und die Beschreibung des Hostings fachlich prüfen und bei Bedarf ergänzen.

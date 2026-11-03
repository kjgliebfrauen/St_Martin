# St. Martin

Liedzettel-Website für den ökumenischen St. Martinszug in Bochum-Linden.

## Lokal starten

Node.js 18 oder neuer wird benötigt. Lege ein Admin-Passwort fest und starte den Server:

```sh
ADMIN_PASSWORD='dein-passwort' node server.js
```

Die Website ist dann unter <http://localhost:4173> erreichbar. Beim Aufruf von `Verwaltung` fragt der Browser nach den Zugangsdaten: Benutzername `admin`, dazu das gesetzte Passwort.

PDF und Liedübersicht werden im Ordner `uploads/` auf dem Server gespeichert. Für den Betrieb im öffentlichen Internet sollte die Website zusätzlich über HTTPS erreichbar sein.

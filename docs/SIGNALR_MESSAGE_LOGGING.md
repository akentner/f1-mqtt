# SignalR Message Logging

Diese Dokumentation beschreibt das umfassende SignalR Message Logging System des F1 MQTT Bridge.

## Übersicht

Das SignalR Message Logging System protokolliert alle ein- und ausgehenden SignalR-Nachrichten in strukturierten Text-Dateien. Dies ist besonders nützlich für:

- **Debugging**: Detaillierte Analyse der SignalR-Kommunikation
- **Monitoring**: Überwachung der Datenübertragung
- **Entwicklung**: Verstehen der F1 Live Timing API-Nachrichten
- **Troubleshooting**: Identifizierung von Verbindungsproblemen

## Konfiguration

### Umgebungsvariablen

```bash
# SignalR Message Logging aktivieren/deaktivieren
SIGNALR_MESSAGE_LOGGING=true

# Pfad zur Log-Datei
SIGNALR_LOG_FILE_PATH=./logs/signalr-messages.log

# Maximale Dateigröße (in Bytes) - Standard: 50MB
SIGNALR_LOG_MAX_FILE_SIZE=52428800

# Maximale Anzahl rotierter Log-Dateien - Standard: 10
SIGNALR_LOG_MAX_FILES=10
```

### Vorkonfigurierte Templates

#### Development (.env.development)

```bash
# Aktiviert für Entwicklung mit detailliertem Logging
SIGNALR_MESSAGE_LOGGING=true
SIGNALR_LOG_FILE_PATH=./logs/signalr-messages-dev.log
SIGNALR_LOG_MAX_FILES=5
```

#### Production (.env.production)

```bash
# Deaktiviert für Produktion (Performance)
SIGNALR_MESSAGE_LOGGING=false
SIGNALR_LOG_FILE_PATH=./logs/signalr-messages.log
SIGNALR_LOG_MAX_FILES=10
```

## Log-Format

Jede Log-Nachricht wird als JSON-Zeile gespeichert:

```json
{
  "timestamp": "2025-08-01T11:28:17.630Z",
  "direction": "incoming",
  "messageType": "HUB_MESSAGE",
  "dataLength": 1024,
  "rawMessage": "{\"H\":\"Streaming\",\"M\":\"feed\",\"A\":[...]}",
  "parsedMessage": {
    "H": "Streaming",
    "M": "feed",
    "A": ["data"]
  },
  "connectionState": "Connected"
}
```

### Felder

- **timestamp**: ISO 8601 Zeitstempel
- **direction**: `incoming` oder `outgoing`
- **messageType**: Typ der Nachricht (siehe unten)
- **dataLength**: Größe der rohen Nachricht in Bytes
- **rawMessage**: Ursprüngliche Nachricht als String
- **parsedMessage**: Geparste JSON-Struktur (falls erfolgreich)
- **parseError**: Fehler beim Parsen (falls aufgetreten)
- **connectionState**: Aktueller Verbindungsstatus

### Message Types

- **HUB_MESSAGE**: Standard Hub-Nachrichten mit Daten
- **RESPONSE_MESSAGE**: Antworten auf Subscription-Anfragen
- **CONNECTION_MESSAGE**: Verbindungsrelevante Nachrichten
- **HEARTBEAT_MESSAGE**: Keep-Alive Nachrichten
- **ERROR_MESSAGE**: Fehlernachrichten
- **UNKNOWN_MESSAGE**: Unbekannte Nachrichtentypen

## Features

### Automatische Datei-Rotation

- **Maximale Dateigröße**: Standard 50MB, konfigurierbar
- **Automatische Rotation**: Neue Datei bei Überschreitung der Maximalgröße
- **Nummerierung**: `signalr-messages.log.1`, `signalr-messages.log.2`, etc.
- **Automatische Bereinigung**: Alte Dateien werden automatisch gelöscht

### Performance-Optimierungen

- **Asynchrone I/O**: Non-blocking Datei-Operationen
- **Pufferung**: Effiziente Schreibvorgänge
- **Selektive Aktivierung**: Nur bei Bedarf aktivieren
- **Minimal Impact**: Keine Auswirkung auf die Hauptanwendung

### Statistiken

Das System führt Statistiken über:

- Anzahl der protokollierten Nachrichten
- Nachrichten pro Typ
- Parse-Erfolgsrate
- Datei-Rotationen

## Verwendung

### Logs analysieren

```bash
# Aktuelle Log-Datei anzeigen
tail -f ./logs/signalr-messages-dev.log

# Nachrichten nach Typ filtern
grep '"messageType":"HUB_MESSAGE"' ./logs/signalr-messages-dev.log

# Parse-Fehler finden
grep '"parseError"' ./logs/signalr-messages-dev.log

# Statistiken mit jq
cat ./logs/signalr-messages-dev.log | jq '.messageType' | sort | uniq -c
```

### Development Workflow

1. **Entwicklungsumgebung aktivieren**:

   ```bash
   cp .env.development .env
   ```

2. **Message Logging aktivieren**:

   ```bash
   echo "SIGNALR_MESSAGE_LOGGING=true" >> .env
   ```

3. **Anwendung starten**:

   ```bash
   npm run dev:watch
   ```

4. **Logs überwachen**:
   ```bash
   tail -f ./logs/signalr-messages-dev.log | jq '.'
   ```

## Troubleshooting

### Häufige Probleme

1. **Log-Datei wird nicht erstellt**:
   - Prüfen Sie die Berechtigungen des `./logs/` Verzeichnisses
   - Stellen Sie sicher, dass `SIGNALR_MESSAGE_LOGGING=true` gesetzt ist

2. **Hoher Speicherverbrauch**:
   - Verringern Sie `SIGNALR_LOG_MAX_FILE_SIZE`
   - Reduzieren Sie `SIGNALR_LOG_MAX_FILES`
   - Deaktivieren Sie das Logging in der Produktion

3. **Performance-Probleme**:
   - Das Logging ist asynchron und sollte minimal Impact haben
   - Bei Problemen `SIGNALR_MESSAGE_LOGGING=false` setzen

### Debug-Informationen

Das System loggt eigene Aktivitäten im Hauptlogger:

```bash
# Logger-Ausgaben mit SignalR Message Logger filtern
grep "SignalRMessageLogger" ./logs/f1-mqtt.log
```

## Integration

Das Message Logging System ist vollständig in den SignalR Client integriert und wird automatisch initialisiert. Keine zusätzliche Konfiguration erforderlich - nur die Umgebungsvariablen setzen.

Die Logs sind kompatibel mit gängigen Log-Analyse-Tools wie:

- **jq**: JSON-Verarbeitung
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Splunk**: Enterprise Log Management
- **Grafana Loki**: Cloud-native Log-Aggregation

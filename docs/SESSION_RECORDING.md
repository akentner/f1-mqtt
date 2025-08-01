# F1 Session Recording & Replay System

Ein umfassendes System zur Aufzeichnung und Wiedergabe von F1 Live Timing Sessions für Entwicklung, Testing und Analyse.

## Übersicht

Das Session Recording System ermöglicht es:

- **Echte F1 Sessions aufzuzeichnen** während sie live laufen
- **Aufgezeichnete Sessions wiederzugeben** für Development und Testing
- **Realistische Testdaten** für die Entwicklung zu verwenden
- **Session-Analysen** durchzuführen ohne auf Live-Events angewiesen zu sein

## System-Komponenten

### 1. SessionRecorder (src/services/session-recorder.ts)

- Zeichnet alle SignalR-Nachrichten einer Session auf
- Speichert Metadaten (Session-Type, Location, Duration, etc.)
- Automatische Session-Erkennung über SessionInfo-Messages
- Datei-Rotation und Größenlimits

### 2. Session Replay Server (test-server/session-replay-server.js)

- Spielt aufgezeichnete Sessions über WebSocket wieder ab
- Web-basierte Control Panel für einfache Bedienung
- Variable Playback-Geschwindigkeit (0.5x - 2x)
- Loop-Funktion für kontinuierliche Tests

### 3. Integration in SignalR Client

- Automatische Recording-Integration
- API für manuelles Recording-Management
- Nahtlose Kompatibilität mit bestehender Funktionalität

## Konfiguration

### Umgebungsvariablen

```bash
# Session Recording aktivieren
SESSION_RECORDING_ENABLED=true

# Pfad für Recording-Dateien
SESSION_RECORDING_PATH=./recordings

# Maximale Recording-Größe (100MB = 104857600 Bytes)
SESSION_RECORDING_MAX_SIZE=104857600

# Automatisches Recording bei SessionInfo
SESSION_RECORDING_AUTO_START=true

# Timeout für Session-Erkennung (30 Sekunden)
SESSION_DETECTION_TIMEOUT=30000

# Keep-Alive Nachrichten filtern (empfohlen für saubere Recordings)
SESSION_RECORDING_FILTER_KEEP_ALIVE=true
```

> **📝 Note**: Die `SESSION_RECORDING_FILTER_KEEP_ALIVE` Option entfernt automatisch SignalR Keep-Alive Nachrichten (leere `{}` Messages und `UNKNOWN` Typen) aus den Recordings. Dies reduziert die Dateigröße erheblich und macht die Recordings sauberer für die Entwicklung.

### Entwicklungsumgebung (.env.development)

```bash
SESSION_RECORDING_ENABLED=true
SESSION_RECORDING_PATH=./recordings
SESSION_RECORDING_MAX_SIZE=104857600  # 100MB
SESSION_RECORDING_AUTO_START=true
SESSION_DETECTION_TIMEOUT=30000       # 30s
SESSION_RECORDING_FILTER_KEEP_ALIVE=true  # Empfohlen für Development
```

### Produktionsumgebung (.env.production)

```bash
SESSION_RECORDING_ENABLED=true
SESSION_RECORDING_PATH=./recordings
SESSION_RECORDING_MAX_SIZE=209715200  # 200MB
SESSION_RECORDING_AUTO_START=true
SESSION_DETECTION_TIMEOUT=30000       # 30s
SESSION_RECORDING_FILTER_KEEP_ALIVE=false # Optional für vollständige Logs
```

## Recording-Format

### Session-Datei-Struktur

```json
{
  "metadata": {
    "sessionId": "abc123def456",
    "sessionType": "Race",
    "sessionName": "Austrian Grand Prix - Race",
    "location": "Red Bull Ring",
    "startTime": "2025-08-01T14:00:00.000Z",
    "endTime": "2025-08-01T16:30:00.000Z",
    "duration": 9000000,
    "recordingVersion": "1.0",
    "messageCount": 15420,
    "totalSize": 5242880
  },
  "messages": [
    {
      "timestamp": "2025-08-01T14:00:00.123Z",
      "relativeTime": 123,
      "messageType": "RESPONSE_MESSAGE",
      "direction": "incoming",
      "rawMessage": "{\"R\":{\"SessionInfo\":{...}}}",
      "parsedMessage": { "R": { "SessionInfo": {...} } },
      "streamName": "SessionInfo",
      "dataSize": 1024
    }
  ]
}
```

### Message-Eigenschaften

- **timestamp**: Absolute Zeit der Nachricht
- **relativeTime**: Millisekunden seit Session-Start
- **messageType**: Art der SignalR-Nachricht
- **direction**: incoming/outgoing
- **rawMessage**: Original JSON-String
- **parsedMessage**: Geparste JSON-Struktur
- **streamName**: F1-Stream-Name (falls verfügbar)
- **dataSize**: Nachrichtengröße in Bytes

## Verwendung

### 1. Session Recording

#### Automatisches Recording

```typescript
// .env konfigurieren
SESSION_RECORDING_ENABLED = true;
SESSION_RECORDING_AUTO_START = true;

// Recording startet automatisch bei SessionInfo-Message
// Keine weitere Konfiguration nötig
```

#### Manuelles Recording

```typescript
import { SignalRClient } from './services/signalr-client';

const client = new SignalRClient(config);

// Recording manuell starten
client.startSessionRecording({
  sessionType: 'Practice',
  sessionName: 'Austrian GP - FP1',
  location: 'Red Bull Ring',
});

// Recording stoppen und Session-Datei speichern
const recording = client.stopSessionRecording();
console.log(`Recording saved: ${recording?.metadata.sessionId}`);

// Status prüfen
if (client.isRecordingSession()) {
  const metadata = client.getCurrentSessionMetadata();
  console.log(`Recording: ${metadata?.sessionName}`);
}
```

### 2. Session Replay

#### Replay Server starten

```bash
# Im test-server Verzeichnis
cd test-server

# Session Replay Server starten
npm run replay

# Oder mit Auto-Reload
npm run replay:dev
```

#### Web Control Panel

```
http://localhost:3002/control
```

Das Control Panel bietet:

- **📁 Liste aller Recordings** mit Metadaten
- **▶️ Playback-Steuerung** (1x, 2x, 0.5x Speed)
- **🔄 Loop-Funktion** für kontinuierliche Tests
- **📊 Replay-Status** in Echtzeit

#### API-Endpunkte

```bash
# Alle Recordings auflisten
GET http://localhost:3002/recordings

# Recording-Details abrufen
GET http://localhost:3002/recordings/{filename}

# Replay starten
POST http://localhost:3002/replay/{filename}
Body: { "speed": 1.0, "loop": false }

# Replay stoppen
POST http://localhost:3002/replay/stop

# Replay-Status
GET http://localhost:3002/replay/status

# Health Check
GET http://localhost:3002/health
```

### 3. Development Workflow

#### Echte Session aufzeichnen

```bash
# 1. Production-Config verwenden
cp .env.production .env

# 2. F1 MQTT Bridge starten (mit echter F1 API)
npm run dev:watch

# 3. Session läuft automatisch auf - Recording startet bei SessionInfo
# 4. Nach Session: Recording wird automatisch gespeichert
```

#### Recording für Tests verwenden

```bash
# 1. Development-Config verwenden
cp .env.development .env

# 2. Replay Server starten
cd test-server && npm run replay

# 3. F1 MQTT Bridge auf Mock Server umstellen
# F1_NEGOTIATE_URL=http://localhost:3001/signalr/negotiate
# F1_CONNECT_URL=ws://localhost:3001/signalr/connect

# 4. Recording über Control Panel abspielen
# http://localhost:3002/control

# 5. F1 MQTT Bridge empfängt replayed Daten
npm run dev:watch
```

## Recording-Management

### Recording-Dateien finden

```bash
# Standard-Pfad
ls -la ./recordings/

# Recordings nach Datum sortiert
ls -lt ./recordings/*.json

# Recording-Informationen anzeigen
jq '.metadata' ./recordings/session_*.json
```

### Recording-Größe optimieren

```bash
# Nur wichtige Streams aufzeichnen
# In .env: Verwende ESSENTIAL statt FULL stream set

# Recording-Größe überwachen
du -h ./recordings/

# Alte Recordings löschen
find ./recordings -name "*.json" -mtime +30 -delete
```

### Recordings konvertieren

```bash
# Messages nach Stream-Type filtern
jq '.messages[] | select(.streamName == "TimingData")' recording.json

# Recording-Statistiken
jq '.metadata | {sessionName, duration, messageCount, totalSize}' recording.json

# Message-Types zählen
jq '.messages | group_by(.messageType) | map({type: .[0].messageType, count: length})' recording.json
```

## Erweiterte Features

### Custom Playback-Speed

```javascript
// 2x Geschwindigkeit für schnelle Tests
fetch('/replay/session.json', {
  method: 'POST',
  body: JSON.stringify({ speed: 2.0 }),
});

// 0.5x Geschwindigkeit für detaillierte Analyse
fetch('/replay/session.json', {
  method: 'POST',
  body: JSON.stringify({ speed: 0.5 }),
});
```

### Loop-Replay für Dauertests

```javascript
// Endlos-Loop für Stress-Tests
fetch('/replay/session.json', {
  method: 'POST',
  body: JSON.stringify({ speed: 1.0, loop: true }),
});
```

### Recording-Analyse

```javascript
// Recording laden und analysieren
const recording = client.loadSessionRecording('session.json');

console.log(`Session: ${recording.metadata.sessionName}`);
console.log(`Messages: ${recording.metadata.messageCount}`);
console.log(`Duration: ${recording.metadata.duration / 1000}s`);

// Message-Types analysieren
const messageTypes = {};
recording.messages.forEach((msg) => {
  messageTypes[msg.messageType] = (messageTypes[msg.messageType] || 0) + 1;
});
console.log('Message types:', messageTypes);
```

## Troubleshooting

### Häufige Probleme

#### Recording startet nicht automatisch

```bash
# Prüfen ob Session Recording aktiviert ist
echo $SESSION_RECORDING_ENABLED

# Prüfen ob Auto-Start aktiviert ist
echo $SESSION_RECORDING_AUTO_START

# Logs überprüfen
grep "Session recorder" ./logs/signalr-messages-dev.log
```

#### Recording-Datei wird nicht erstellt

```bash
# Recording-Verzeichnis prüfen
ls -la ./recordings/

# Berechtigungen prüfen
chmod 755 ./recordings/

# Speicherplatz prüfen
df -h .
```

#### Replay funktioniert nicht

```bash
# Replay Server Status prüfen
curl http://localhost:3002/health

# Recording-Datei validieren
jq . ./recordings/session.json > /dev/null

# WebSocket-Verbindung testen
wscat -c ws://localhost:3002
```

### Performance-Optimierung

#### Recording-Größe reduzieren

```bash
# Nur essentielle Streams verwenden
# In SignalR Client: setStreamSet('ESSENTIAL')

# Kürzere Sessions aufzeichnen
# Recording nach wichtigen Events stoppen
```

#### Replay-Performance verbessern

```bash
# Playback-Speed anpassen
# Niedrigere Speed bei großen Sessions

# Message-Buffer begrenzen
# Nur relevante Message-Types replaying
```

## Integration mit CI/CD

### Automatisierte Tests mit Recordings

```yaml
# GitHub Actions Beispiel
- name: Test with recorded session
  run: |
    # Recording-Datei aus Artifacts laden
    cp test-data/race-session.json recordings/

    # Replay Server starten
    cd test-server && npm run replay &

    # Recording abspielen
    curl -X POST http://localhost:3002/replay/race-session.json

    # Tests gegen replayed Daten laufen lassen
    npm test
```

### Regression Testing

```bash
# Baseline-Recording erstellen
cp production-session.json test-data/baseline.json

# Nach Code-Änderungen testen
npm run test:replay test-data/baseline.json
```

## Best Practices

### Recording

1. **Vollständige Sessions aufzeichnen** - vom SessionInfo bis zum Session-Ende
2. **Aussagekräftige Namen** verwenden für einfache Identifizierung
3. **Recording-Größe überwachen** - große Sessions können mehrere MB werden
4. **Regelmäßige Bereinigung** alter Recordings

### Replay

1. **Realistische Playback-Speed** verwenden (0.5x - 2x)
2. **Loop-Funktion sparsam** einsetzen - kann System belasten
3. **Multiple Clients testen** - mehrere Connections zum Replay Server
4. **Error-Handling testen** - unterbrochene Replays, korrupte Dateien

### Development

1. **Separate Recording-Umgebung** für Production verwenden
2. **Version-Control** für wichtige Recording-Dateien
3. **Dokumentation** der Recording-Inhalte und -Zwecke
4. **Automatisierte Tests** mit Standard-Recordings

Das Session Recording & Replay System bietet eine professionelle Lösung für die Entwicklung mit echten F1-Daten, ohne auf Live-Events angewiesen zu sein! 🏎️📼

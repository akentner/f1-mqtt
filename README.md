# F1 MQTT Bridge

Ein TypeScript-basierter Server, der F1-Timing-Daten von SignalR empfängt, verarbeitet und an einen MQTT-Broker weiterleitet. Speziell entwickelt für die Integration mit Home Assistant.

## 🏎️ Features

- **SignalR Client**: Verbindung zu F1 Live-Timing-Daten
- **MQTT Publisher**: Veröffentlichung der Events auf MQTT
- **Event Processing**: Intelligente Batch-Verarbeitung und Daten-Transformation
- **Home Assistant Integration**: Automatische Discovery-Konfiguration
- **Health Monitoring**: REST-API für Status und Metriken
- **Docker Support**: Vollständig containerisiert
- **DevContainer**: VS Code Development Container
- **Home Assistant Addon**: Bereit für HA-Addon-Deployment

## 🛠️ Technologie-Stack

- **TypeScript** - Typsichere Entwicklung
- **SignalR Client** - Echtzeit-Datenverbindung
- **MQTT.js** - MQTT-Client-Bibliothek
- **Express.js** - Web-Server für Health-Checks
- **Jest** - Testing Framework
- **ESLint + Prettier** - Code-Qualität und Formatierung
- **Docker** - Containerisierung

## 🚀 Schnellstart

### Mit DevContainer (Empfohlen)

1. Öffnen Sie das Projekt in VS Code
2. Klicken Sie auf "Reopen in Container" wenn die Benachrichtigung erscheint
3. Der DevContainer wird automatisch eingerichtet

### Lokale Entwicklung

```bash
# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeiten Sie .env mit Ihren Einstellungen

# Projekt bauen
npm run build

# Entwicklungsserver starten
npm run dev

# Mit Watch-Modus
npm run dev:watch
```

### Mit Docker Compose

```bash
# Services starten (inklusive MQTT Broker)
npm run docker:run

# Logs verfolgen
npm run docker:logs

# Services stoppen
npm run docker:stop
```

## ⚙️ Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `SIGNALR_HUB_URL` | SignalR Hub URL | `https://livetiming.formula1.com/signalr` |
| `SIGNALR_HUB_NAME` | SignalR Hub Name | `f1TimingHub` |
| `SIGNALR_ACCESS_TOKEN` | Optionales Access Token | - |
| `MQTT_BROKER_URL` | MQTT Broker URL | `mqtt://localhost:1883` |
| `MQTT_USERNAME` | MQTT Benutzername | - |
| `MQTT_PASSWORD` | MQTT Passwort | - |
| `MQTT_CLIENT_ID` | MQTT Client ID | `f1-mqtt-bridge` |
| `MQTT_TOPIC_PREFIX` | MQTT Topic Prefix | `f1` |
| `MQTT_QOS` | MQTT QoS Level (0-2) | `1` |
| `MQTT_RETAIN` | MQTT Retain Flag | `false` |
| `LOG_LEVEL` | Log Level | `info` |
| `PORT` | HTTP Server Port | `3000` |
| `HA_DISCOVERY_PREFIX` | HA Discovery Prefix | `homeassistant` |
| `HA_NODE_ID` | HA Node ID | `f1_telemetry` |

## 📁 Projektstruktur

```
f1-mqtt/
├── src/                    # TypeScript Quellcode
│   ├── config/            # Konfiguration
│   ├── services/          # Core Services
│   │   ├── signalr-client.ts
│   │   ├── mqtt-publisher.ts
│   │   ├── event-processor.ts
│   │   └── health-server.ts
│   ├── types/             # TypeScript Definitionen
│   ├── utils/             # Hilfsfunktionen
│   ├── __tests__/         # Unit Tests
│   └── index.ts           # Hauptanwendung
├── .devcontainer/         # VS Code DevContainer
├── homeassistant/         # Home Assistant Addon
├── docker/                # Docker Konfigurationen
├── dist/                  # Kompilierte JavaScript-Dateien
└── docs/                  # Dokumentation (zukünftig)
```

## 🧪 Testing

```bash
# Tests ausführen
npm test

# Tests mit Watch-Modus
npm run test:watch

# Coverage Report
npm run test:coverage
```

## 🔧 Development

### Code-Qualität

```bash
# Linting
npm run lint
npm run lint:fix

# Formatierung
npm run format
npm run format:check
```

### VS Code Extensions

Die folgenden Extensions werden automatisch im DevContainer installiert:

- TypeScript und JavaScript Language Features
- ESLint
- Prettier
- Docker
- Test Explorer

## 🏠 Home Assistant Integration

### Als Addon installieren

1. Projekt für HA Addon bauen:
   ```bash
   npm run homeassistant:build
   ```

2. Addon-Verzeichnis in Home Assistant kopieren

3. Addon über die HA-Oberfläche installieren und konfigurieren

### MQTT Topics

Die Anwendung publiziert Events unter folgenden Topics:

- `f1/timing` - Timing-Daten
- `f1/car_data` - Auto-Telemetrie
- `f1/session_info` - Session-Informationen
- `f1/status` - Bridge-Status (online/offline)

### Home Assistant Entities

Automatisch erstellte Entities:

- `sensor.f1_session_data` - Hauptsensor mit Session-Daten
- `binary_sensor.f1_bridge_status` - Bridge-Verbindungsstatus

## 📊 Monitoring

### Health Check Endpoints

- `GET /health` - Einfacher Health Check
- `GET /status` - Detaillierte Status-Informationen
- `GET /metrics` - Prometheus-kompatible Metriken
- `GET /` - API-Übersicht

### Beispiel Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "signalR": "connected",
    "mqtt": "connected"
  },
  "queue": {
    "size": 0,
    "processing": false
  },
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 29360128,
    "heapUsed": 20221440,
    "external": 1089024
  }
}
```

## 🐳 Docker Deployment

### Standalone Container

```bash
# Image bauen
docker build -t f1-mqtt-bridge .

# Container starten
docker run -d \
  --name f1-mqtt-bridge \
  -p 3000:3000 \
  -e MQTT_BROKER_URL=mqtt://your-broker:1883 \
  f1-mqtt-bridge
```

### Mit Docker Compose

Das bereitgestellte `docker-compose.yml` startet:
- F1 MQTT Bridge
- Mosquitto MQTT Broker
- MQTT Explorer (für Debugging)

## 🔒 Sicherheit

- Läuft als Non-Root-User
- Umgebungsvariablen für sensible Daten
- Health-Check-Integration
- Graceful Shutdown-Handling

## 🚧 Zukünftige Erweiterungen

- [ ] **Web GUI** - React-basierte Benutzeroberfläche
- [ ] **Erweiterte Filterung** - Konfigurierbare Event-Filter
- [ ] **Datenbank-Integration** - Historische Datenspeicherung
- [ ] **Alerting** - Benachrichtigungen bei kritischen Events
- [ ] **Multi-Tenant** - Unterstützung mehrerer F1-Sessions
- [ ] **WebSocket API** - Echtzeit-Daten für GUI

## 📝 Best Practices

- **Typsicherheit**: Vollständige TypeScript-Unterstützung
- **Error Handling**: Umfassendes Error-Management
- **Logging**: Strukturiertes Logging mit konfigurierbaren Leveln
- **Testing**: Unit- und Integration-Tests
- **Code-Qualität**: ESLint und Prettier Integration
- **Monitoring**: Health-Checks und Metriken
- **Containerisierung**: Docker-First-Ansatz
- **Documentation**: Comprehensive README und Code-Kommentare

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/amazing-feature`)
3. Committe deine Änderungen (`git commit -m 'Add amazing feature'`)
4. Pushe den Branch (`git push origin feature/amazing-feature`)
5. Öffne einen Pull Request

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe [LICENSE](LICENSE) für Details.

## 🆘 Support

- **Issues**: GitHub Issues für Bug-Reports und Feature-Requests
- **Discussions**: GitHub Discussions für Fragen und Community-Support
- **Wiki**: Erweiterte Dokumentation im GitHub Wiki

## 🏁 Acknowledgments

- Formula 1 für die Live-Timing-Daten
- SignalR Community
- MQTT.org
- Home Assistant Community

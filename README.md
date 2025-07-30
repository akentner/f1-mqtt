# F1 MQTT Bridge

A TypeScript-based server that receives, processes, and forwards F1 timing data from SignalR to an MQTT broker. Specifically designed for integration with Home Assistant.

## 🏎️ Features

- **SignalR Client**: Connection to F1 Live Timing data
- **MQTT Publisher**: Publishing events to MQTT
- **Event Processing**: Intelligent batch processing and data transformation
- **Home Assistant Integration**: Automatic discovery configuration
- **Health Monitoring**: REST API for status and metrics
- **Docker Support**: Fully containerized
- **DevContainer**: VS Code Development Container
- **Home Assistant Addon**: Ready for HA addon deployment

## 🛠️ Technology Stack

- **TypeScript** - Type-safe development
- **SignalR Client** - Real-time data connection
- **MQTT.js** - MQTT client library
- **Express.js** - Web server for health checks
- **Jest** - Testing framework
- **ESLint + Prettier** - Code quality and formatting
- **Docker** - Containerization

## 🚀 Quick Start

### With DevContainer (Recommended)

1. Open the project in VS Code
2. Click "Reopen in Container" when the notification appears
3. The DevContainer will be set up automatically

### Local Development

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your settings

# Build project
npm run build

# Start development server
npm run dev

# With watch mode
npm run dev:watch
```

### With Docker Compose

```bash
# Start services (including MQTT broker)
npm run docker:run

# Follow logs
npm run docker:logs

# Stop services
npm run docker:stop
```

## ⚙️ Configuration

### Environment Variables

| Variable               | Description           | Default                                   |
| ---------------------- | --------------------- | ----------------------------------------- |
| `SIGNALR_HUB_URL`      | SignalR Hub URL       | `https://livetiming.formula1.com/signalr` |
| `SIGNALR_HUB_NAME`     | SignalR Hub Name      | `f1TimingHub`                             |
| `SIGNALR_ACCESS_TOKEN` | Optional Access Token | -                                         |
| `MQTT_BROKER_URL`      | MQTT Broker URL       | `mqtt://localhost:1883`                   |
| `MQTT_USERNAME`        | MQTT Username         | -                                         |
| `MQTT_PASSWORD`        | MQTT Password         | -                                         |
| `MQTT_CLIENT_ID`       | MQTT Client ID        | `f1-mqtt-bridge`                          |
| `MQTT_TOPIC_PREFIX`    | MQTT Topic Prefix     | `f1`                                      |
| `MQTT_QOS`             | MQTT QoS Level (0-2)  | `1`                                       |
| `MQTT_RETAIN`          | MQTT Retain Flag      | `false`                                   |
| `LOG_LEVEL`            | Log Level             | `info`                                    |
| `PORT`                 | HTTP Server Port      | `3000`                                    |
| `HA_DISCOVERY_PREFIX`  | HA Discovery Prefix   | `homeassistant`                           |
| `HA_NODE_ID`           | HA Node ID            | `f1_telemetry`                            |

## 📁 Project Structure

```
f1-mqtt/
├── src/                    # TypeScript source code
│   ├── config/            # Configuration
│   ├── services/          # Core Services
│   │   ├── signalr-client.ts
│   │   ├── mqtt-publisher.ts
│   │   ├── event-processor.ts
│   │   └── health-server.ts
│   ├── types/             # TypeScript definitions
│   ├── utils/             # Utility functions
│   ├── __tests__/         # Unit Tests
│   └── index.ts           # Main application
├── .devcontainer/         # VS Code DevContainer
├── homeassistant/         # Home Assistant Addon
├── docker/                # Docker configurations
├── dist/                  # Compiled JavaScript files
└── docs/                  # Documentation (future)
```

## 🧪 Testing

```bash
# Run tests
npm test

# Tests with watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🔧 Development

### Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

### VS Code Extensions

The following extensions are automatically installed in the DevContainer:

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Docker
- Test Explorer

## 🏠 Home Assistant Integration

### Install as Addon

1. Build project for HA addon:

   ```bash
   npm run homeassistant:build
   ```

2. Copy addon directory to Home Assistant

3. Install and configure addon via HA interface

### MQTT Topics

The application publishes events under the following topics:

- `f1/timing` - Timing data
- `f1/car_data` - Car telemetry
- `f1/session_info` - Session information
- `f1/status` - Bridge status (online/offline)

### Home Assistant Entities

Automatically created entities:

- `sensor.f1_session_data` - Main sensor with session data
- `binary_sensor.f1_bridge_status` - Bridge connection status

## 📊 Monitoring

### Health Check Endpoints

- `GET /health` - Simple health check
- `GET /status` - Detailed status information
- `GET /metrics` - Prometheus-compatible metrics
- `GET /` - API overview

### Example Health Check Response

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
# Build image
docker build -t f1-mqtt-bridge .

# Start container
docker run -d \
  --name f1-mqtt-bridge \
  -p 3000:3000 \
  -e MQTT_BROKER_URL=mqtt://your-broker:1883 \
  f1-mqtt-bridge
```

### With Docker Compose

The provided `docker-compose.yml` starts:

- F1 MQTT Bridge
- Mosquitto MQTT Broker
- MQTT Explorer (for debugging)

## 🔒 Security

- Runs as non-root user
- Environment variables for sensitive data
- Health check integration
- Graceful shutdown handling

## 🚧 Future Enhancements

- [ ] **Web GUI** - React-based user interface
- [ ] **Advanced Filtering** - Configurable event filters
- [ ] **Database Integration** - Historical data storage
- [ ] **Alerting** - Notifications for critical events
- [ ] **Multi-Tenant** - Support for multiple F1 sessions
- [ ] **WebSocket API** - Real-time data for GUI

## 📝 Best Practices

- **Type Safety**: Full TypeScript support
- **Error Handling**: Comprehensive error management
- **Logging**: Structured logging with configurable levels
- **Testing**: Unit and integration tests
- **Code Quality**: ESLint and Prettier integration
- **Monitoring**: Health checks and metrics
- **Containerization**: Docker-first approach
- **Documentation**: Comprehensive README and code comments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🆘 Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and community support
- **Wiki**: Extended documentation in the GitHub Wiki

## 🏁 Acknowledgments

- Formula 1 for the Live Timing data
- SignalR Community
- MQTT.org
- Home Assistant Community

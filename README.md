# F1 MQTT Bridge

A TypeScript-based server that receives, processes, and forwards F1 timing data from SignalR to an MQTT broker. Specifically designed for integration with Home Assistant.

## 🏎️ Features

- **SignalR Client**: Connection to F1 Live Timing data
- **MQTT Publisher**: Publishing events to MQTT
- **Event Processing**: Intelligent batch processing and data transformation
- **Session Recording**: Multi-mode recording system with 70% size reduction
- **Recording Analysis**: Tools for analyzing and converting session recordings
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

The application uses a hierarchical environment configuration system:

1. **`.env`** - Base configuration (committed to git)
2. **`.env.local`** - Local overrides (gitignored, not committed)

The `.env.local` file allows you to override any settings for local development without modifying committed files.

### Setting up Local Configuration

1. Copy the example file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` to override any values from `.env`:

   ```bash
   # Example: Override MQTT broker for local development
   MQTT_BROKER_URL=mqtt://192.168.1.100:1883
   MQTT_TOPIC_PREFIX=f1_dev

   # Example: Enable debug features
   LOG_LEVEL=debug
   SESSION_RECORDING_ENABLED=true
   SESSION_RECORDING_MODE=hybrid
   ```

3. The application will automatically load both files:
   - `.env` provides base configuration
   - `.env.local` overrides specific values

**Note**: `.env.local` is gitignored and should contain your personal development settings.

### Topic-Specific Retain Configuration

The application supports configurable retain behavior for specific MQTT topics using patterns:

```bash
# Configure which topics should be retained (JSON format)
MQTT_RETAINED_TOPICS=[
  {"pattern": "session_info", "retain": true, "description": "Session information"},
  {"pattern": "driver_list", "retain": true, "description": "Driver list"},
  {"pattern": "timing/**", "retain": true, "description": "All timing data"},
  {"pattern": "car_data", "retain": false, "description": "Car data not retained"},
  {"pattern": "**/status", "retain": true, "description": "All status topics"}
]
```

**Pattern Wildcards:**

- `*` matches any single segment (e.g., `timing/*` matches `timing/lap` but not `timing/lap/sector`)
- `**` matches any number of segments (e.g., `timing/**` matches `timing/lap/sector/1`)
- Exact matches are supported (e.g., `session_info` matches only `session_info`)

**Use Cases:**

- **Retained**: Session info, driver lists, track status, weather - data that should persist
- **Not Retained**: Real-time telemetry, timing data - data that becomes stale quickly

### Environment Variables

| Variable                    | Description                                     | Default                                   |
| --------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `SIGNALR_HUB_URL`           | SignalR Hub URL                                 | `https://livetiming.formula1.com/signalr` |
| `SIGNALR_HUB_NAME`          | SignalR Hub Name                                | `f1TimingHub`                             |
| `SIGNALR_ACCESS_TOKEN`      | Optional Access Token                           | -                                         |
| `MQTT_BROKER_URL`           | MQTT Broker URL                                 | `mqtt://localhost:1883`                   |
| `MQTT_USERNAME`             | MQTT Username                                   | -                                         |
| `MQTT_PASSWORD`             | MQTT Password                                   | -                                         |
| `MQTT_CLIENT_ID`            | MQTT Client ID                                  | `f1-mqtt-bridge`                          |
| `MQTT_TOPIC_PREFIX`         | MQTT Topic Prefix                               | `f1`                                      |
| `MQTT_QOS`                  | MQTT QoS Level (0-2)                            | `1`                                       |
| `MQTT_RETAIN`               | MQTT Retain Flag                                | `false`                                   |
| `MQTT_RETAINED_TOPICS`      | Topic-specific retain config (JSON)             | See below                                 |
| `LOG_LEVEL`                 | Log Level                                       | `info`                                    |
| `PORT`                      | HTTP Server Port                                | `3000`                                    |
| `HA_DISCOVERY_PREFIX`       | HA Discovery Prefix                             | `homeassistant`                           |
| `HA_NODE_ID`                | HA Node ID                                      | `f1_telemetry`                            |
| `SESSION_RECORDING_ENABLED` | Enable session recording                        | `false`                                   |
| `SESSION_RECORDING_MODE`    | Recording mode (disabled/raw/structured/hybrid) | `structured`                              |
| `SESSION_RECORDING_PATH`    | Recording files path                            | `./recordings`                            |

## 📁 Project Structure

```
f1-mqtt/
├── src/                    # TypeScript source code
│   ├── config/            # Configuration
│   ├── services/          # Core Services
│   │   ├── signalr-client.ts
│   │   ├── mqtt-publisher.ts
│   │   ├── event-processor.ts
│   │   ├── health-server.ts
│   │   ├── session-recorder.ts
│   │   └── signalr-message-logger.ts
│   ├── types/             # TypeScript definitions
│   ├── utils/             # Utility functions
│   ├── __tests__/         # Unit Tests
│   └── index.ts           # Main application
├── .devcontainer/         # VS Code DevContainer
├── homeassistant/         # Home Assistant Addon
├── docker/                # Docker configurations
├── tools/                 # Analysis and utility tools
│   └── recording-analyzer.js
├── recordings/            # Session recording files
├── dist/                  # Compiled JavaScript files
└── docs/                  # Comprehensive documentation
```

## 🧪 Testing

```bash
# Run tests
npm test

# Tests with watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Recording analysis tools
npm run recording:analyze <file>
npm run recording:convert <input> <output> <mode>
npm run recording:compare
```

## 📼 Session Recording

The application supports recording F1 sessions for development and analysis:

### Recording Modes

- **`raw`**: Minimal file size (~70% smaller) - ideal for production
- **`structured`**: Full metadata and parsed data - best for development
- **`hybrid`**: Balanced approach with smart filtering
- **`disabled`**: No recording

### Quick Setup

```bash
# Enable recording in development
SESSION_RECORDING_ENABLED=true
SESSION_RECORDING_MODE=hybrid

# Analyze existing recordings
npm run recording:compare

# Convert between modes
npm run recording:convert session.json session-raw.json raw
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

This project is for developed with support of GitHub Copilot with Claude Sonnet 4.

This project is unofficial and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trademarks of Formula One Licensing B.V.

## 🆘 Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and community support
- **Wiki**: Extended documentation in the GitHub Wiki

## 🏁 Acknowledgments

- Formula 1 for the Live Timing data
- SignalR Community
- MQTT.org
- Home Assistant Community

## 🙏 Credits

This project was heavily inspired by:

- https://github.com/slowlydev/f1-dash
- https://github.com/Nicxe/f1_sensor

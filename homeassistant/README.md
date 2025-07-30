# Home Assistant Add-on: F1 MQTT Bridge

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]
![Supports armhf Architecture][armhf-shield]
![Supports armv7 Architecture][armv7-shield]
![Supports i386 Architecture][i386-shield]

[![Open your Home Assistant instance and show the add-on store.][addon-badge]][addon]

Bridge F1 timing data from SignalR to MQTT for seamless Home Assistant integration.

## About

The F1 MQTT Bridge connects to Formula 1's live timing SignalR stream and publishes the data to your MQTT broker, making it available for Home Assistant automations and dashboards.

## Features

- **Real-time F1 Data**: Live timing, car telemetry, and session information
- **MQTT Integration**: Publishes data to your existing MQTT broker
- **Home Assistant Discovery**: Automatic device and entity creation
- **Health Monitoring**: Built-in health checks and status reporting
- **TypeScript**: Written in TypeScript for reliability and maintainability

## Installation

1. Navigate in your Home Assistant frontend to **Supervisor** → **Add-on Store**
2. Add this repository: `https://github.com/your-username/f1-mqtt-bridge`
3. Find the "F1 MQTT Bridge" add-on and click it
4. Click on the "INSTALL" button

## Configuration

Add-on configuration:

```yaml
signalr_hub_url: "https://livetiming.formula1.com/signalr"
signalr_hub_name: "f1TimingHub"
mqtt_broker_url: "mqtt://core-mosquitto:1883"
mqtt_topic_prefix: "f1"
mqtt_qos: 1
mqtt_retain: false
log_level: "info"
ha_discovery_prefix: "homeassistant"
ha_node_id: "f1_telemetry"
```

### Option: `signalr_hub_url`

The SignalR hub URL for F1 timing data.

### Option: `signalr_hub_name`

The name of the SignalR hub to connect to.

### Option: `signalr_access_token` (optional)

Access token for SignalR authentication, if required.

### Option: `mqtt_broker_url`

The URL of your MQTT broker. Use `mqtt://core-mosquitto:1883` for the official Home Assistant MQTT add-on.

### Option: `mqtt_username` (optional)

Username for MQTT broker authentication.

### Option: `mqtt_password` (optional)

Password for MQTT broker authentication.

### Option: `mqtt_topic_prefix`

Prefix for all MQTT topics published by this add-on.

### Option: `mqtt_qos`

MQTT Quality of Service level (0, 1, or 2).

### Option: `mqtt_retain`

Whether MQTT messages should be retained.

### Option: `log_level`

Logging level: `debug`, `info`, `warn`, or `error`.

### Option: `ha_discovery_prefix`

Home Assistant discovery prefix.

### Option: `ha_node_id`

Node ID for Home Assistant device identification.

## Usage

After installation and configuration:

1. Start the add-on
2. Check the logs for successful connection messages
3. Your F1 data will appear as MQTT topics under your configured prefix
4. Home Assistant will automatically discover new entities

## MQTT Topics

The add-on publishes data to these topic patterns:

- `f1/timing` - Lap times and sector data
- `f1/car_data` - Vehicle telemetry
- `f1/session_info` - Session status and information
- `f1/status` - Bridge connection status

## Health Check

The add-on provides a health check endpoint at `http://localhost:3000/health` that monitors:

- SignalR connection status
- MQTT connection status
- Event processing queue
- System resources

## Support

Got questions?

You could [open an issue here][issue] on GitHub.

## Authors & contributors

The original setup of this repository is by [Your Name][your-github].

## License

MIT License

Copyright (c) 2025 F1 MQTT Bridge

[addon-badge]: https://my.home-assistant.io/badges/supervisor_addon.svg
[addon]: https://my.home-assistant.io/redirect/supervisor_addon/?addon=your-username_f1-mqtt-bridge
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[issue]: https://github.com/your-username/f1-mqtt-bridge/issues
[your-github]: https://github.com/your-username

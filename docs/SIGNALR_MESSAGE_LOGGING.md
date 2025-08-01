# SignalR Message Logging

This documentation describes the comprehensive SignalR Message Logging System of the F1 MQTT Bridge.

## Overview

The SignalR Message Logging System logs all incoming and outgoing SignalR messages in structured text files. This is particularly useful for:

- **Debugging**: Detailed analysis of SignalR communication
- **Monitoring**: Monitoring data transmission
- **Development**: Understanding F1 Live Timing API messages
- **Troubleshooting**: Identifying connection problems

## Configuration

### Environment Variables

```bash
# Enable/disable SignalR message logging
SIGNALR_MESSAGE_LOGGING=true

# Path to log file
SIGNALR_LOG_FILE_PATH=./logs/signalr-messages.log

# Maximum file size (in bytes) - Default: 50MB
SIGNALR_LOG_MAX_FILE_SIZE=52428800

# Maximum number of rotated log files - Default: 10
SIGNALR_LOG_MAX_FILES=10
```

### Preconfigured Templates

#### Development (.env.development)

```bash
# Enabled for development with detailed logging
SIGNALR_MESSAGE_LOGGING=true
SIGNALR_LOG_FILE_PATH=./logs/signalr-messages-dev.log
SIGNALR_LOG_MAX_FILES=5
```

#### Production (.env.production)

```bash
# Disabled for production (performance)
SIGNALR_MESSAGE_LOGGING=false
SIGNALR_LOG_FILE_PATH=./logs/signalr-messages.log
SIGNALR_LOG_MAX_FILES=10
```

## Log Format

Each log message is stored as a JSON line:

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

### Fields

- **timestamp**: ISO 8601 timestamp
- **direction**: `incoming` or `outgoing`
- **messageType**: Type of message (see below)
- **dataLength**: Size of raw message in bytes
- **rawMessage**: Original message as string
- **parsedMessage**: Parsed JSON structure (if successful)
- **parseError**: Parsing error (if occurred)
- **connectionState**: Current connection status

### Message Types

- **HUB_MESSAGE**: Standard hub messages with data
- **RESPONSE_MESSAGE**: Responses to subscription requests
- **CONNECTION_MESSAGE**: Connection-related messages
- **HEARTBEAT_MESSAGE**: Keep-alive messages
- **ERROR_MESSAGE**: Error messages
- **UNKNOWN_MESSAGE**: Unknown message types

## Features

### Automatic File Rotation

- **Maximum file size**: Default 50MB, configurable
- **Automatic rotation**: New file when maximum size is exceeded
- **Numbering**: `signalr-messages.log.1`, `signalr-messages.log.2`, etc.
- **Automatic cleanup**: Old files are automatically deleted

### Performance Optimizations

- **Asynchronous I/O**: Non-blocking file operations
- **Buffering**: Efficient write operations
- **Selective activation**: Only enable when needed
- **Minimal impact**: No effect on main application

### Statistics

The system tracks statistics on:

- Number of logged messages
- Messages per type
- Parse success rate
- File rotations

## Usage

### Analyze Logs

```bash
# Show current log file
tail -f ./logs/signalr-messages-dev.log

# Filter messages by type
grep '"messageType":"HUB_MESSAGE"' ./logs/signalr-messages-dev.log

# Find parse errors
grep '"parseError"' ./logs/signalr-messages-dev.log

# Statistics with jq
cat ./logs/signalr-messages-dev.log | jq '.messageType' | sort | uniq -c
```

### Development Workflow

1. **Enable development environment**:

   ```bash
   cp .env.development .env
   ```

2. **Enable message logging**:

   ```bash
   echo "SIGNALR_MESSAGE_LOGGING=true" >> .env
   ```

3. **Start application**:

   ```bash
   npm run dev:watch
   ```

4. **Monitor logs**:
   ```bash
   tail -f ./logs/signalr-messages-dev.log | jq '.'
   ```

## Troubleshooting

### Common Problems

1. **Log file is not created**:
   - Check permissions of the `./logs/` directory
   - Ensure `SIGNALR_MESSAGE_LOGGING=true` is set

2. **High memory usage**:
   - Reduce `SIGNALR_LOG_MAX_FILE_SIZE`
   - Reduce `SIGNALR_LOG_MAX_FILES`
   - Disable logging in production

3. **Performance issues**:
   - Logging is asynchronous and should have minimal impact
   - If problems occur, set `SIGNALR_MESSAGE_LOGGING=false`

### Debug Information

The system logs its own activities in the main logger:

```bash
# Filter logger outputs with SignalR Message Logger
grep "SignalRMessageLogger" ./logs/f1-mqtt.log
```

## Integration

The Message Logging System is fully integrated into the SignalR Client and is automatically initialized. No additional configuration required - just set the environment variables.

The logs are compatible with common log analysis tools such as:

- **jq**: JSON processing
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Splunk**: Enterprise log management
- **Grafana Loki**: Cloud-native log aggregation

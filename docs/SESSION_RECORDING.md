# F1 Session Recording & Replay System

A comprehensive system for recording and replaying F1 Live Timing Sessions for development, testing, and analysis.

## Overview

The Session Recording System enables:

- **Recording real F1 sessions** while they run live
- **Replaying recorded sessions** for development and testing
- **Using realistic test data** for development
- **Performing session analysis** without depending on live events

## System Components

### 1. SessionRecorder (src/services/session-recorder.ts)

- Records all SignalR messages of a session
- Stores metadata (Session-Type, Location, Duration, etc.)
- Automatic session detection via SessionInfo messages
- File rotation and size limits

### 2. Session Replay Server (test-server/session-replay-server.js)

- Replays recorded sessions via WebSocket
- Web-based control panel for easy operation
- Variable playback speed (0.5x - 2x)
- Loop function for continuous testing

### 3. Integration in SignalR Client

- Automatic recording integration
- API for manual recording management
- Seamless compatibility with existing functionality

## Configuration

### Environment Variables

```bash
# Enable session recording
SESSION_RECORDING_ENABLED=true

# Recording mode selection
SESSION_RECORDING_MODE=hybrid              # disabled|raw|structured|hybrid

# Path for recording files
SESSION_RECORDING_PATH=./recordings

# Maximum recording size (100MB = 104857600 Bytes)
SESSION_RECORDING_MAX_SIZE=104857600

# Automatic recording on SessionInfo
SESSION_RECORDING_AUTO_START=true

# Timeout for session detection (30 seconds)
SESSION_DETECTION_TIMEOUT=30000

# Filter keep-alive messages (recommended for clean recordings)
SESSION_RECORDING_FILTER_KEEP_ALIVE=true
```

### Recording Modes

- **`disabled`**: No recording (minimal overhead)
- **`raw`**: Raw messages only (~70% smaller files)
- **`structured`**: Full structured data with metadata
- **`hybrid`**: Smart mode - structured for important messages, raw for others

> **📝 Note**: The `SESSION_RECORDING_FILTER_KEEP_ALIVE` option automatically removes SignalR keep-alive messages (empty `{}` messages and `UNKNOWN` types) from recordings. This significantly reduces file size and makes recordings cleaner for development.

### Development Environment (.env.development)

```bash
SESSION_RECORDING_ENABLED=true
SESSION_RECORDING_MODE=hybrid             # Balanced efficiency
SESSION_RECORDING_PATH=./recordings
SESSION_RECORDING_MAX_SIZE=104857600      # 100MB
SESSION_RECORDING_AUTO_START=true
SESSION_DETECTION_TIMEOUT=30000           # 30s
SESSION_RECORDING_FILTER_KEEP_ALIVE=true  # Recommended for development
```

### Production Environment (.env.production)

```bash
SESSION_RECORDING_ENABLED=true
SESSION_RECORDING_MODE=raw                # Maximum efficiency
SESSION_RECORDING_PATH=./recordings
SESSION_RECORDING_MAX_SIZE=209715200      # 200MB
SESSION_RECORDING_AUTO_START=true
SESSION_DETECTION_TIMEOUT=30000           # 30s
SESSION_RECORDING_FILTER_KEEP_ALIVE=false # Optional for complete logs
```

## Recording Format

### Session File Structure

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
    "recordingMode": "hybrid",
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

### Message Properties

- **timestamp**: Absolute time of the message
- **relativeTime**: Milliseconds since session start
- **messageType**: Type of SignalR message
- **direction**: incoming/outgoing
- **rawMessage**: Original JSON string
- **parsedMessage**: Parsed JSON structure
- **streamName**: F1 stream name (if available)
- **dataSize**: Message size in bytes

## Usage

### 1. Session Recording

#### Automatic Recording

```typescript
// Configure .env
SESSION_RECORDING_ENABLED = true;
SESSION_RECORDING_AUTO_START = true;

// Recording starts automatically on SessionInfo message
// No further configuration needed
```

#### Manual Recording

```typescript
import { SignalRClient } from './services/signalr-client';

const client = new SignalRClient(config);

// Start recording manually
client.startSessionRecording({
  sessionType: 'Practice',
  sessionName: 'Austrian GP - FP1',
  location: 'Red Bull Ring',
});

// Stop recording and save session file
const recording = client.stopSessionRecording();
console.log(`Recording saved: ${recording?.metadata.sessionId}`);

// Check status
if (client.isRecordingSession()) {
  const metadata = client.getCurrentSessionMetadata();
  console.log(`Recording: ${metadata?.sessionName}`);
}
```

### 2. Session Replay

#### Start Replay Server

```bash
# In test-server directory
cd test-server

# Start session replay server
npm run replay

# Or with auto-reload
npm run replay:dev
```

#### Web Control Panel

```
http://localhost:3002/control
```

The Control Panel offers:

- **📁 List of all recordings** with metadata
- **▶️ Playback controls** (1x, 2x, 0.5x Speed)
- **🔄 Loop function** for continuous testing
- **📊 Real-time replay status**

#### API Endpoints

```bash
# List all recordings
GET http://localhost:3002/recordings

# Get recording details
GET http://localhost:3002/recordings/{filename}

# Start replay
POST http://localhost:3002/replay/{filename}
Body: { "speed": 1.0, "loop": false }

# Stop replay
POST http://localhost:3002/replay/stop

# Replay status
GET http://localhost:3002/replay/status

# Health check
GET http://localhost:3002/health
```

### 3. Development Workflow

#### Record Real Session

```bash
# 1. Use production config
cp .env.production .env

# 2. Start F1 MQTT Bridge (with real F1 API)
npm run dev:watch

# 3. Session runs automatically - recording starts on SessionInfo
# 4. After session: Recording is automatically saved
```

#### Use Recording for Tests

```bash
# 1. Use development config
cp .env.development .env

# 2. Start replay server
cd test-server && npm run replay

# 3. Switch F1 MQTT Bridge to mock server
# F1_NEGOTIATE_URL=http://localhost:3001/signalr/negotiate
# F1_CONNECT_URL=ws://localhost:3001/signalr/connect

# 4. Play recording via control panel
# http://localhost:3002/control

# 5. F1 MQTT Bridge receives replayed data
npm run dev:watch
```

## Recording Management

### Find Recording Files

```bash
# Standard path
ls -la ./recordings/

# Recordings sorted by date
ls -lt ./recordings/*.json

# Show recording information
jq '.metadata' ./recordings/session_*.json
```

### Optimize Recording Size

```bash
# Record only important streams
# In .env: Use ESSENTIAL instead of FULL stream set

# Monitor recording size
du -h ./recordings/

# Delete old recordings
find ./recordings -name "*.json" -mtime +30 -delete
```

### Convert Recordings

```bash
# Filter messages by stream type
jq '.messages[] | select(.streamName == "TimingData")' recording.json

# Recording statistics
jq '.metadata | {sessionName, duration, messageCount, totalSize}' recording.json

# Count message types
jq '.messages | group_by(.messageType) | map({type: .[0].messageType, count: length})' recording.json

# Convert between recording modes
npm run recording:convert input.json output.json raw
```

## Advanced Features

### Custom Playback Speed

```javascript
// 2x speed for fast testing
fetch('/replay/session.json', {
  method: 'POST',
  body: JSON.stringify({ speed: 2.0 }),
});

// 0.5x speed for detailed analysis
fetch('/replay/session.json', {
  method: 'POST',
  body: JSON.stringify({ speed: 0.5 }),
});
```

### Loop Replay for Continuous Testing

```javascript
// Endless loop for stress testing
fetch('/replay/session.json', {
  method: 'POST',
  body: JSON.stringify({ speed: 1.0, loop: true }),
});
```

### Recording Analysis

```javascript
// Load and analyze recording
const recording = client.loadSessionRecording('session.json');

console.log(`Session: ${recording.metadata.sessionName}`);
console.log(`Messages: ${recording.metadata.messageCount}`);
console.log(`Duration: ${recording.metadata.duration / 1000}s`);

// Analyze message types
const messageTypes = {};
recording.messages.forEach((msg) => {
  messageTypes[msg.messageType] = (messageTypes[msg.messageType] || 0) + 1;
});
console.log('Message types:', messageTypes);
```

## Troubleshooting

### Common Problems

#### Recording doesn't start automatically

```bash
# Check if session recording is enabled
echo $SESSION_RECORDING_ENABLED

# Check if auto-start is enabled
echo $SESSION_RECORDING_AUTO_START

# Check logs
grep "Session recorder" ./logs/signalr-messages-dev.log
```

#### Recording file is not created

```bash
# Check recording directory
ls -la ./recordings/

# Check permissions
chmod 755 ./recordings/

# Check disk space
df -h .
```

#### Replay doesn't work

```bash
# Check replay server status
curl http://localhost:3002/health

# Validate recording file
jq . ./recordings/session.json > /dev/null

# Test WebSocket connection
wscat -c ws://localhost:3002
```

### Performance Optimization

#### Reduce Recording Size

```bash
# Use only essential streams
# In SignalR Client: setStreamSet('ESSENTIAL')

# Record shorter sessions
# Stop recording after important events
```

#### Improve Replay Performance

```bash
# Adjust playback speed
# Lower speed for large sessions

# Limit message buffer
# Only replay relevant message types
```

## CI/CD Integration

### Automated Tests with Recordings

```yaml
# GitHub Actions example
- name: Test with recorded session
  run: |
    # Load recording file from artifacts
    cp test-data/race-session.json recordings/

    # Start replay server
    cd test-server && npm run replay &

    # Play recording
    curl -X POST http://localhost:3002/replay/race-session.json

    # Run tests against replayed data
    npm test
```

### Regression Testing

```bash
# Create baseline recording
cp production-session.json test-data/baseline.json

# Test after code changes
npm run test:replay test-data/baseline.json
```

## Best Practices

### Recording

1. **Record complete sessions** - from SessionInfo to session end
2. **Use meaningful names** for easy identification
3. **Monitor recording size** - large sessions can become several MB
4. **Regular cleanup** of old recordings

### Replay

1. **Use realistic playback speed** (0.5x - 2x)
2. **Use loop function sparingly** - can stress the system
3. **Test multiple clients** - multiple connections to replay server
4. **Test error handling** - interrupted replays, corrupt files

### Development

1. **Use separate recording environment** for production
2. **Version control** for important recording files
3. **Document** recording contents and purposes
4. **Automated tests** with standard recordings

The Session Recording & Replay System provides a professional solution for developing with real F1 data without depending on live events! 🏎️📼

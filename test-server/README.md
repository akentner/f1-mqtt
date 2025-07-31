# F1 Mock SignalR Server

A development server that mimics the F1 Live Timing SignalR API for testing and development purposes.

## Features

- 🏎️ Complete F1 SignalR API simulation
- 📡 WebSocket support with SignalR protocol
- 🎮 Control panel for testing scenarios
- 📊 Mock timing data generation
- 🏁 Race simulation with live updates
- 💚 Health monitoring endpoint

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start with auto-reload (development)
npm run dev
```

The server will start on port 3001 by default.

## Endpoints

### SignalR Endpoints

- `GET /signalr/negotiate` - SignalR negotiation endpoint
- `WS /signalr/connect` - WebSocket connection endpoint

### Control Panel

- `POST /control/start-race` - Start race simulation
- `POST /control/stop-race` - Stop race simulation
- `POST /control/send-message` - Send custom race control message

### Monitoring

- `GET /health` - Health check and connection status

## Usage with F1 MQTT Bridge

To use this mock server with the main F1 MQTT Bridge application, update your environment variables:

```bash
# In your main application .env file
SIGNALR_NEGOTIATE_URL=http://localhost:3001/signalr/negotiate
SIGNALR_CONNECT_URL=ws://localhost:3001/signalr/connect
```

Or update the SIGNALR_DEFAULTS in your SignalR client:

```typescript
const SIGNALR_DEFAULTS = {
  // ... other settings
  NEGOTIATE_URL: 'http://localhost:3001/signalr/negotiate',
  CONNECT_URL: 'ws://localhost:3001/signalr/connect',
  // ... other settings
};
```

## Mock Data

The server generates realistic F1 data including:

- **Session Info**: Test Grand Prix session details
- **Driver List**: Sample drivers (VER, PER, HAM, RUS, LEC, SAI)
- **Timing Data**: Realistic lap times and positions
- **Race Control Messages**: Various race events and flags
- **Track Status**: Green/red flag status

## Testing Scenarios

### Start a Race

```bash
curl -X POST http://localhost:3001/control/start-race
```

### Stop a Race

```bash
curl -X POST http://localhost:3001/control/stop-race
```

### Send Custom Message

```bash
curl -X POST http://localhost:3001/control/send-message \
  -H "Content-Type: application/json" \
  -d '{"message": "SAFETY CAR DEPLOYED"}'
```

### Check Status

```bash
curl http://localhost:3001/health
```

## Integration Example

```typescript
// Use mock server in development
const isDevelopment = process.env.NODE_ENV === 'development';

const signalRConfig = {
  negotiateUrl: isDevelopment
    ? 'http://localhost:3001/signalr/negotiate'
    : 'https://livetiming.formula1.com/signalr/negotiate',
  connectUrl: isDevelopment
    ? 'ws://localhost:3001/signalr/connect'
    : 'wss://livetiming.formula1.com/signalr/connect',
};
```

## Development Features

- **Realistic Timing**: Lap times vary by position with random variation
- **Race Events**: Random race control messages and flag changes
- **Pit Stops**: Simulated pit stop scenarios
- **Connection Management**: Proper WebSocket lifecycle handling
- **Debugging**: Comprehensive logging of all interactions

## Docker Support

```dockerfile
# Add to your docker-compose.yml for development
services:
  f1-mock-server:
    build: ./test-server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode

## Notes

- This server is for development and testing only
- Do not use in production
- The mock data is generated and not real F1 timing data
- WebSocket connections are automatically cleaned up on disconnect

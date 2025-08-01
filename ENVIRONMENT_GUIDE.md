# 🏎️ F1 MQTT Bridge - Environment Configuration Guide

## 🎯 Problem Solved

**Before**: Environment switching required modifying source code
**After**: Clean .env-based configuration management

## 🛠️ How It Works

### 1. Environment Variables

```bash
# Development
F1_NEGOTIATE_URL=http://localhost:3001/signalr/negotiate
F1_CONNECT_URL=ws://localhost:3001/signalr/connect

# Production (default)
F1_NEGOTIATE_URL=https://livetiming.formula1.com/signalr/negotiate
F1_CONNECT_URL=wss://livetiming.formula1.com/signalr/connect
```

### 2. Configuration Files

- `.env.development` - Mock server setup with debug logging
- `.env.production` - Real F1 API with production optimizations
- `.env` - Active configuration (auto-generated, gitignored)

### 3. Environment Switcher

```bash
cd test-server

# Switch environments (copies .env files, no source changes)
node switch-environment.js dev     # → Development mode
node switch-environment.js prod    # → Production mode

  # → Show current config
```

## 🚀 Quick Start

### Development Setup

```bash
# 1. Switch to development
cd test-server
./setup.sh switch-dev

# 2. Start mock server
./setup.sh dev

# 3. Start main application (in another terminal)
cd ..
npm run dev:watch
```

### Production Setup

```bash
# 1. Switch to production
cd test-server
./setup.sh switch-prod

# 2. Start main application
cd ..
npm start
```

## ✅ Benefits

1. **No Source Code Changes**: Environment switching via configuration only
2. **Clean Separation**: Clear development vs production settings
3. **12-Factor Compliance**: Configuration through environment variables
4. **Safe Workflow**: No risk of accidentally committing development URLs
5. **Easy Deployment**: Different .env files for different environments
6. **Comprehensive Settings**: Logging, MQTT, memory management per environment

## 🔧 Advanced Usage

### Custom Configuration

```bash
# Create custom .env template
node switch-environment.js custom

# Edit .env manually for specific needs
vim .env

# Reset to defaults
node switch-environment.js clean
```

### Environment Detection

The application automatically detects configuration:

- Reads `F1_NEGOTIATE_URL` and `F1_CONNECT_URL` from environment
- Falls back to production defaults if not set
- Uses `NODE_ENV` for logging and optimization levels

### Docker Integration

```yaml
# docker-compose.override.yml for development
services:
  f1-mqtt-bridge:
    environment:
      - F1_NEGOTIATE_URL=http://f1-mock-server:3001/signalr/negotiate
      - F1_CONNECT_URL=ws://f1-mock-server:3001/signalr/connect
```

## 📋 Configuration Reference

### Development Environment

- **F1 API**: Mock server (localhost:3001)
- **Logging**: Debug level, console output
- **MQTT Topic**: `f1/dev` (isolated from production)
- **Memory**: GC enabled, lower limits for development
- **Node**: Development mode, auto-reload support
- **Session Recording**: Enabled with keep-alive filtering

### Production Environment

- **F1 API**: Official Formula 1 Live Timing
- **Logging**: Info level, file output with rotation
- **MQTT Topic**: `f1` (production topics)
- **Memory**: Optimized limits, production GC settings
- **Node**: Production mode, performance optimizations
- **Home Assistant**: Discovery enabled
- **Session Recording**: Configurable via environment variables

### Session Recording Variables

```bash
# Session Recording Configuration
SESSION_RECORDING_ENABLED=true
SESSION_RECORDING_PATH=./recordings
SESSION_RECORDING_MAX_SIZE=104857600
SESSION_RECORDING_AUTO_START=true
SESSION_DETECTION_TIMEOUT=30000
SESSION_RECORDING_FILTER_KEEP_ALIVE=true  # Filter out keep-alive messages
```

This solution provides professional environment management without the risks of source code modification! 🎉

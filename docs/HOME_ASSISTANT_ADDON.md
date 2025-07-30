# Home Assistant Add-on Migration

## ✅ Update to Official Home Assistant Add-on Base

The Home Assistant Add-on has been successfully migrated to the official `hassio-addons/base` structure, based on best practices from [hassio-addons](https://github.com/hassio-addons).

### 🔄 What was changed:

#### **Dockerfile** (`homeassistant/Dockerfile`)

- **Base Image**: `ghcr.io/hassio-addons/base:18.0.3` instead of Node.js Alpine
- **Build Arguments**: Full integration of official build parameters
- **Package Management**: APK-based installation with build dependencies
- **S6-Overlay**: Uses the S6 supervision system of the base
- **Labels**: Complete OpenContainers labels

#### **Run Script** (`homeassistant/run.sh`)

- **S6-Integration**: Compatible with the S6 supervision system
- **Bashio Integration**: Uses `bashio::config` for configuration
- **Logging**: Structured logging with `bashio::log.info`
- **Service Structure**: Follows official add-on conventions

#### **Configuration** (`homeassistant/config.json`)

- **Extended Options**: Watchdog, AppArmor, service dependencies
- **Image Reference**: GitHub Container Registry integration
- **Security**: AppArmor profiles, no privileged rights
- **Services**: MQTT service dependency defined

#### **Build System** (`homeassistant/build.sh`)

- **Multi-Architecture**: Automatic build for all supported architectures
- **Manifest Creation**: Docker manifest for multi-arch support
- **Build Arguments**: Complete metadata integration
- **Registry Push**: Ready for GitHub Container Registry

### 🏗️ Build Process:

```bash
# Single build (for testing)
npm run homeassistant:build-single

# Multi-architecture build (for production)
npm run homeassistant:build
```

### 📂 Add-on Structure:

```
homeassistant/
├── Dockerfile              # Home Assistant Add-on Dockerfile
├── config.json            # Add-on configuration
├── README.md              # Add-on documentation
├── run.sh                 # Service start script
└── build.sh               # Multi-arch build script
```

### 🔧 Supported Architectures:

- **aarch64** - ARM 64-bit (Raspberry Pi 4, etc.)
- **amd64** - Intel/AMD 64-bit
- **armhf** - ARM 32-bit Hard Float
- **armv7** - ARM 32-bit v7
- **i386** - Intel 32-bit

### 🚀 Deployment:

1. **Prepare Registry:**

   ```bash
   # GitHub Container Registry Login
   echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
   ```

2. **Build and Push:**

   ```bash
   ./homeassistant/build.sh
   docker manifest push ghcr.io/your-username/f1-mqtt-bridge:1.0.0
   docker manifest push ghcr.io/your-username/f1-mqtt-bridge:latest
   ```

3. **Home Assistant Integration:**
   - Add repository to Home Assistant
   - Install add-on via UI
   - Adjust configuration
   - Start and monitor logs

### 📋 Benefits of the New Structure:

- ✅ **Official Standard**: Follows hassio-addons conventions
- ✅ **Multi-Architecture**: Automatic support for all HA platforms
- ✅ **S6-Supervision**: Robust service management
- ✅ **Bashio Integration**: Native Home Assistant configuration
- ✅ **Security**: AppArmor profiles and non-root execution
- ✅ **Monitoring**: Integrated health checks and watchdog
- ✅ **Logging**: Structured logging in HA logs

### 🔍 Debugging:

```bash
# Show add-on logs
ha addons logs f1-mqtt-bridge

# Check add-on status
ha addons info f1-mqtt-bridge

# Test container directly
docker run --rm -it ghcr.io/your-username/f1-mqtt-bridge:latest
```

The add-on is now fully compatible with official Home Assistant Add-on standards! 🎉

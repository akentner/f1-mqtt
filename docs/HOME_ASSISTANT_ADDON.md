# Home Assistant Add-on Migration

## ✅ Aktualisierung auf offizielle Home Assistant Add-on Basis

Das Home Assistant Add-on wurde erfolgreich auf die offizielle `hassio-addons/base` Struktur umgestellt, basierend auf den Best Practices von [hassio-addons](https://github.com/hassio-addons).

### 🔄 Was wurde geändert:

#### **Dockerfile** (`homeassistant/Dockerfile`)
- **Basis-Image**: `ghcr.io/hassio-addons/base:18.0.3` statt Node.js Alpine
- **Build-Argumente**: Vollständige Integration der offiziellen Build-Parameter
- **Paket-Management**: APK-basierte Installation mit Build-Dependencies
- **S6-Overlay**: Nutzt das S6-Supervision-System der Basis
- **Labels**: Vollständige OpenContainers-Labels

#### **Run-Script** (`homeassistant/run.sh`)
- **S6-Integration**: Kompatibel mit dem S6-Supervision-System
- **Bashio-Integration**: Verwendet `bashio::config` für Konfiguration
- **Logging**: Strukturiertes Logging mit `bashio::log.info`
- **Service-Struktur**: Folgt den offiziellen Add-on Konventionen

#### **Konfiguration** (`homeassistant/config.json`)
- **Erweiterte Optionen**: Watchdog, AppArmor, Service-Dependencies
- **Image-Referenz**: GitHub Container Registry Integration
- **Security**: AppArmor-Profile, keine privilegierten Rechte
- **Services**: MQTT-Service-Dependency definiert

#### **Build-System** (`homeassistant/build.sh`)
- **Multi-Architecture**: Automatischer Build für alle unterstützten Architekturen
- **Manifest-Creation**: Docker-Manifest für Multi-Arch-Support
- **Build-Argumente**: Vollständige Metadaten-Integration
- **Registry-Push**: Bereit für GitHub Container Registry

### 🏗️ Build-Prozess:

```bash
# Einzelner Build (für Tests)
npm run homeassistant:build-single

# Multi-Architecture Build (für Production)
npm run homeassistant:build
```

### 📂 Add-on Struktur:

```
homeassistant/
├── Dockerfile              # Home Assistant Add-on Dockerfile
├── config.json            # Add-on Konfiguration
├── README.md              # Add-on Dokumentation
├── run.sh                 # Service-Start-Script
└── build.sh               # Multi-Arch Build-Script
```

### 🔧 Unterstützte Architekturen:

- **aarch64** - ARM 64-bit (Raspberry Pi 4, etc.)
- **amd64** - Intel/AMD 64-bit
- **armhf** - ARM 32-bit Hard Float
- **armv7** - ARM 32-bit v7
- **i386** - Intel 32-bit

### 🚀 Deployment:

1. **Registry vorbereiten:**
   ```bash
   # GitHub Container Registry Login
   echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
   ```

2. **Build und Push:**
   ```bash
   ./homeassistant/build.sh
   docker manifest push ghcr.io/your-username/f1-mqtt-bridge:1.0.0
   docker manifest push ghcr.io/your-username/f1-mqtt-bridge:latest
   ```

3. **Home Assistant Integration:**
   - Repository in Home Assistant hinzufügen
   - Add-on über die UI installieren
   - Konfiguration anpassen
   - Starten und Logs überwachen

### 📋 Vorteile der neuen Struktur:

- ✅ **Offizieller Standard**: Folgt den hassio-addons Konventionen
- ✅ **Multi-Architecture**: Automatischer Support für alle HA-Plattformen
- ✅ **S6-Supervision**: Robuste Service-Verwaltung
- ✅ **Bashio-Integration**: Native Home Assistant Konfiguration
- ✅ **Security**: AppArmor-Profile und Non-Root-Execution
- ✅ **Monitoring**: Integrierte Health-Checks und Watchdog
- ✅ **Logging**: Strukturiertes Logging in HA-Logs

### 🔍 Debugging:

```bash
# Add-on Logs anzeigen
ha addons logs f1-mqtt-bridge

# Add-on Status prüfen
ha addons info f1-mqtt-bridge

# Container direkt testen
docker run --rm -it ghcr.io/your-username/f1-mqtt-bridge:latest
```

Das Add-on ist jetzt vollständig kompatibel mit den offiziellen Home Assistant Add-on Standards! 🎉

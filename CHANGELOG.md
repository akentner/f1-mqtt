# Changelog

All notable changes to the F1 MQTT Bridge project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-08-01

### Added

- **Hierarchical Environment Configuration**: Added `.env.local` support for local development overrides
- **Override Functionality**: `.env.local` values automatically override `.env` base configuration
- **Local Development Workflow**: `.env.local.example` template for easy setup
- **Configuration Documentation**: Updated README with hierarchical configuration setup guide

### Changed

- **Environment Loading**: Enhanced env-loader to support override mode for local configurations
- **Configuration Management**: Improved separation between base configuration and local overrides

### Fixed

- **Environment Variable Loading**: Proper override behavior for local development settings

## [1.1.0] - 2025-08-01

### 🎯 Major Features Added

- **Multi-Mode Session Recording System** with 4 recording modes
- **Recording Analysis Tools** for file analysis and conversion
- **Smart File Size Optimization** with up to 70% size reduction
- **Complete Documentation Translation** from German to English

### ✨ Recording System Features

- `raw` mode: Minimal file size (~70% smaller) for production
- `structured` mode: Full metadata and parsed data for development
- `hybrid` mode: Balanced approach with smart message filtering
- `disabled` mode: No recording for minimal overhead

### 🛠️ Developer Tools

- `recording-analyzer.js`: Comprehensive analysis and conversion tool
- New NPM scripts: `recording:analyze`, `recording:convert`, `recording:compare`
- Mode conversion between all recording formats
- Detailed performance metrics and file size analysis

### ⚙️ Configuration Enhancements

- Environment-based configuration with `.env.development` and `.env.production`
- Type-safe `SessionRecordingMode` validation
- `SESSION_RECORDING_MODE` environment variable
- Backwards compatible with existing recordings

### 📚 Documentation Improvements

- Translated `SESSION_RECORDING.md` to English with comprehensive updates
- Translated `SIGNALR_MESSAGE_LOGGING.md` to English
- Created new `RECORDING_MODES.md` with detailed mode comparison
- Updated `ENVIRONMENT_GUIDE.md` with recording configuration
- Created `PROJECT_STATUS.md` for development tracking

### 🔧 Technical Improvements

- Enhanced `SessionRecorder` with mode-specific message processing
- Smart message filtering for hybrid mode
- Improved memory management and buffer handling
- Automatic session detection and recording
- File rotation and size limit management

### 📊 Performance Results

- **Raw mode**: 6.7 MB (70% reduction from 18.3 MB baseline)
- **Hybrid mode**: 7.1 MB (61% reduction from baseline)
- **Structured mode**: 18.3 MB (full features, baseline)

### 🐛 Bug Fixes

- Fixed TypeScript compilation errors with new recording modes
- Corrected spelling errors in README.md ("heaviely" → "heavily", "inspiered" → "inspired")
- Improved error handling in session recording

### 🎨 UI/UX Improvements

- Added 🙏 emoji to Credits section for better visual appeal
- Enhanced README.md with new features and recording documentation
- Improved project structure documentation

## [1.0.0] - 2025-07-31

### 🎉 Initial Release

- **SignalR Client** for F1 Live Timing data connection
- **MQTT Publisher** for Home Assistant integration
- **Event Processing** with intelligent batch processing
- **Health Monitoring** with REST API endpoints
- **Docker Support** with full containerization
- **DevContainer** setup for VS Code development
- **Home Assistant Addon** ready for deployment

### 🏗️ Core Architecture

- TypeScript-based development with full type safety
- Modular service architecture with clean separation of concerns
- Comprehensive error handling and logging
- Environment-based configuration system

### 🧪 Testing & Quality

- Jest testing framework setup
- ESLint and Prettier integration
- Unit tests for core services
- Code coverage reporting

### 📖 Documentation

- Comprehensive README.md
- Docker deployment instructions
- Home Assistant integration guide
- Development setup documentation

---

## Legend

- 🎯 **Major Features**: Significant new functionality
- ✨ **Features**: New features and capabilities
- 🛠️ **Tools**: Developer tools and utilities
- ⚙️ **Configuration**: Configuration and setup improvements
- 📚 **Documentation**: Documentation updates and translations
- 🔧 **Technical**: Technical improvements and optimizations
- 📊 **Performance**: Performance improvements and metrics
- 🐛 **Bug Fixes**: Bug fixes and error corrections
- 🎨 **UI/UX**: User interface and experience improvements
- 🏗️ **Architecture**: Architectural changes and improvements
- 🧪 **Testing**: Testing and quality improvements
- 📖 **Documentation**: Documentation and guides

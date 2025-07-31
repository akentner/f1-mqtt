#!/usr/bin/env node

/**
 * F1 Environment Switcher
 * 
 * Utility to switch between production F1 API and development mock server
 * Uses .env files instead of modifying source code
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const ENV_DEVELOPMENT = path.join(PROJECT_ROOT, '.env.development');
const ENV_PRODUCTION = path.join(PROJECT_ROOT, '.env.production');

function copyEnvFile(sourceFile, targetFile) {
  try {
    if (!fs.existsSync(sourceFile)) {
      console.error(`❌ Source environment file not found: ${sourceFile}`);
      process.exit(1);
    }

    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✅ Copied ${path.basename(sourceFile)} to .env`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error copying environment file:`, error.message);
    return false;
  }
}

function getCurrentEnvironment() {
  try {
    if (!fs.existsSync(ENV_FILE)) {
      return 'none';
    }
    
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    
    if (content.includes('localhost:3001')) {
      return 'development';
    } else if (content.includes('NODE_ENV=development')) {
      return 'development';
    } else if (content.includes('NODE_ENV=production')) {
      return 'production';
    } else {
      // Try to detect by F1 URLs
      if (content.includes('F1_NEGOTIATE_URL=http://localhost')) {
        return 'development';
      } else if (content.includes('F1_NEGOTIATE_URL=https://livetiming.formula1.com')) {
        return 'production';
      }
      
      return 'unknown';
    }
  } catch (error) {
    console.error(`❌ Error reading .env file:`, error.message);
    return 'error';
  }
}

function showCurrentConfig() {
  try {
    if (!fs.existsSync(ENV_FILE)) {
      console.log('No .env file found - using default configuration');
      console.log('📡 Negotiate URL: https://livetiming.formula1.com/signalr/negotiate (default)');
      console.log('🔗 Connect URL: wss://livetiming.formula1.com/signalr/connect (default)');
      return;
    }
    
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    const lines = content.split('\n');
    
    let negotiateUrl = 'https://livetiming.formula1.com/signalr/negotiate (default)';
    let connectUrl = 'wss://livetiming.formula1.com/signalr/connect (default)';
    let nodeEnv = 'production (default)';
    
    lines.forEach(line => {
      if (line.startsWith('F1_NEGOTIATE_URL=')) {
        negotiateUrl = line.split('=')[1];
      } else if (line.startsWith('F1_CONNECT_URL=')) {
        connectUrl = line.split('=')[1];
      } else if (line.startsWith('NODE_ENV=')) {
        nodeEnv = line.split('=')[1];
      }
    });
    
    console.log(`Environment: ${nodeEnv}`);
    console.log(`📡 Negotiate URL: ${negotiateUrl}`);
    console.log(`🔗 Connect URL: ${connectUrl}`);
    
  } catch (error) {
    console.error(`❌ Error reading configuration:`, error.message);
  }
}

function switchToDevelopment() {
  console.log('🔄 Switching to development environment...');
  
  if (copyEnvFile(ENV_DEVELOPMENT, ENV_FILE)) {
    console.log('');
    console.log('✅ Switched to development environment!');
    console.log('');
    console.log('📋 Development configuration:');
    console.log('   📡 F1 API: Mock server (localhost:3001)');
    console.log('   🐛 Logging: Debug level');
    console.log('   📊 MQTT Topic: f1/dev');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Start mock server: cd test-server && npm start');
    console.log('   2. Start main app: npm run dev:watch');
    console.log('   3. Test: curl http://localhost:3001/health');
  }
}

function switchToProduction() {
  console.log('🔄 Switching to production environment...');
  
  if (copyEnvFile(ENV_PRODUCTION, ENV_FILE)) {
    console.log('');
    console.log('✅ Switched to production environment!');
    console.log('');
    console.log('📋 Production configuration:');
    console.log('   📡 F1 API: Official Formula 1 Live Timing');
    console.log('   📊 Logging: Info level');
    console.log('   📁 Log file: ./logs/f1-mqtt.log');
    console.log('   🏠 Home Assistant: Enabled');
    console.log('');
    console.log('⚠️  Production notes:');
    console.log('   - Configure MQTT authentication if needed');
    console.log('   - Set up proper log rotation');
    console.log('   - Monitor memory usage');
  }
}

function createCustomEnv() {
  const customTemplate = `# F1 MQTT Bridge - Custom Configuration

# ==============================================
# F1 Live Timing API Configuration
# ==============================================

# Choose your F1 API endpoints:
# For production (real F1 data):
# F1_NEGOTIATE_URL=https://livetiming.formula1.com/signalr/negotiate
# F1_CONNECT_URL=wss://livetiming.formula1.com/signalr/connect

# For development (mock server):
F1_NEGOTIATE_URL=http://localhost:3001/signalr/negotiate
F1_CONNECT_URL=ws://localhost:3001/signalr/connect

# ==============================================
# MQTT Configuration
# ==============================================

MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=f1-mqtt-bridge-custom
MQTT_TOPIC_PREFIX=f1
MQTT_QOS=1
MQTT_RETAIN=false

# ==============================================
# Logging
# ==============================================

LOG_LEVEL=info
LOG_ENABLE_CONSOLE=true

# ==============================================
# Server
# ==============================================

SERVER_PORT=8080
NODE_ENV=development
`;

  try {
    fs.writeFileSync(ENV_FILE, customTemplate);
    console.log('✅ Created custom .env file');
    console.log('📝 Edit .env to customize your configuration');
  } catch (error) {
    console.error(`❌ Error creating custom .env:`, error.message);
  }
}

function showUsage() {
  console.log('🏎️  F1 Environment Switcher');
  console.log('');
  console.log('Manages environment configuration via .env files (no source code changes!)');
  console.log('');
  console.log('Usage: node switch-environment.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  dev, development  - Switch to development (mock server)');
  console.log('  prod, production  - Switch to production (real F1 API)');
  console.log('  status            - Show current environment configuration');
  console.log('  custom            - Create a custom .env template');
  console.log('  clean             - Remove .env file (use defaults)');
  console.log('');
  console.log('Examples:');
  console.log('  node switch-environment.js dev     # Use mock server');
  console.log('  node switch-environment.js prod    # Use real F1 API');
  console.log('  node switch-environment.js status  # Show current config');
  console.log('');
  console.log('Environment files:');
  console.log('  .env.development  - Development configuration template');
  console.log('  .env.production   - Production configuration template');
  console.log('  .env             - Active configuration (auto-generated)');
}

// Main execution
const command = process.argv[2];

if (!command) {
  showUsage();
  process.exit(1);
}

switch (command.toLowerCase()) {
  case 'status':
    const current = getCurrentEnvironment();
    console.log(`Current environment: ${current}`);
    console.log('');
    showCurrentConfig();
    break;
    
  case 'production':
  case 'prod':
    switchToProduction();
    break;
    
  case 'development':
  case 'dev':
    switchToDevelopment();
    break;
    
  case 'custom':
    createCustomEnv();
    break;
    
  case 'clean':
    try {
      if (fs.existsSync(ENV_FILE)) {
        fs.unlinkSync(ENV_FILE);
        console.log('✅ Removed .env file - using default configuration');
        console.log('� F1 API: Official Formula 1 Live Timing (default)');
      } else {
        console.log('ℹ️  No .env file found - already using defaults');
      }
    } catch (error) {
      console.error(`❌ Error removing .env file:`, error.message);
    }
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showUsage();
    break;
    
  default:
    console.error(`❌ Unknown command: ${command}`);
    showUsage();
    process.exit(1);
}

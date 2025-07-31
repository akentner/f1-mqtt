#!/usr/bin/env node

/**
 * F1 Environment Switcher
 * 
 * Utility to switch between production F1 API and development mock server
 */

const fs = require('fs');
const path = require('path');

const SIGNALR_CLIENT_PATH = path.join(__dirname, '../src/services/signalr-client.ts');

const ENDPOINTS = {
  production: {
    NEGOTIATE_URL: 'https://livetiming.formula1.com/signalr/negotiate',
    CONNECT_URL: 'wss://livetiming.formula1.com/signalr/connect',
  },
  development: {
    NEGOTIATE_URL: 'http://localhost:3001/signalr/negotiate',
    CONNECT_URL: 'ws://localhost:3001/signalr/connect',
  }
};

function updateSignalRClient(environment) {
  if (!ENDPOINTS[environment]) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.log('Available environments: production, development');
    process.exit(1);
  }

  try {
    let content = fs.readFileSync(SIGNALR_CLIENT_PATH, 'utf8');
    
    const endpoints = ENDPOINTS[environment];
    
    // Replace NEGOTIATE_URL
    content = content.replace(
      /NEGOTIATE_URL:\s*'[^']*'/,
      `NEGOTIATE_URL: '${endpoints.NEGOTIATE_URL}'`
    );
    
    // Replace CONNECT_URL  
    content = content.replace(
      /CONNECT_URL:\s*'[^']*'/,
      `CONNECT_URL: '${endpoints.CONNECT_URL}'`
    );
    
    fs.writeFileSync(SIGNALR_CLIENT_PATH, content);
    
    console.log(`✅ Switched to ${environment} environment:`);
    console.log(`📡 Negotiate URL: ${endpoints.NEGOTIATE_URL}`);
    console.log(`🔗 Connect URL: ${endpoints.CONNECT_URL}`);
    
    if (environment === 'development') {
      console.log('\n💡 Remember to start the mock server:');
      console.log('   cd test-server && npm start');
    }
    
  } catch (error) {
    console.error(`❌ Error updating SignalR client:`, error.message);
    process.exit(1);
  }
}

function getCurrentEnvironment() {
  try {
    const content = fs.readFileSync(SIGNALR_CLIENT_PATH, 'utf8');
    
    if (content.includes('localhost:3001')) {
      return 'development';
    } else if (content.includes('livetiming.formula1.com')) {
      return 'production';
    } else {
      return 'unknown';
    }
  } catch (error) {
    console.error(`❌ Error reading SignalR client:`, error.message);
    return 'error';
  }
}

function showUsage() {
  console.log('F1 Environment Switcher');
  console.log('');
  console.log('Usage: node switch-environment.js [environment]');
  console.log('');
  console.log('Environments:');
  console.log('  production   - Use official F1 Live Timing API');
  console.log('  development  - Use local mock server (localhost:3001)');
  console.log('  status       - Show current environment');
  console.log('');
  console.log('Examples:');
  console.log('  node switch-environment.js development');
  console.log('  node switch-environment.js production');
  console.log('  node switch-environment.js status');
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
    if (current !== 'unknown' && current !== 'error') {
      const endpoints = ENDPOINTS[current];
      if (endpoints) {
        console.log(`📡 Negotiate URL: ${endpoints.NEGOTIATE_URL}`);
        console.log(`🔗 Connect URL: ${endpoints.CONNECT_URL}`);
      }
    }
    break;
    
  case 'production':
  case 'prod':
    updateSignalRClient('production');
    break;
    
  case 'development':
  case 'dev':
    updateSignalRClient('development');
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

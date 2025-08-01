#!/usr/bin/env node

// Test Session Recording System
const fs = require('fs');
const path = require('path');

console.log('🧪 Session Recording Test Script');
console.log('================================');

// Test 1: Check recordings directory
const recordingsDir = './recordings';
console.log('📁 Checking recordings directory...');
if (fs.existsSync(recordingsDir)) {
  console.log('✅ Recordings directory exists');
  const files = fs.readdirSync(recordingsDir);
  console.log(`   Found ${files.length} files:`, files);
} else {
  console.log('❌ Recordings directory does not exist');
  console.log('   Creating directory...');
  try {
    fs.mkdirSync(recordingsDir, { recursive: true });
    console.log('✅ Created recordings directory');
  } catch (error) {
    console.log('❌ Failed to create directory:', error.message);
  }
}

// Test 2: Check environment variables
console.log('\n🔧 Environment Variables:');
const envVars = [
  'SESSION_RECORDING_ENABLED',
  'SESSION_RECORDING_AUTO_START',
  'SESSION_RECORDING_PATH',
  'SESSION_RECORDING_MAX_SIZE'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   ${varName}: ${value || 'NOT SET'}`);
});

// Test 3: Check .env file
console.log('\n📄 .env File Content:');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const sessionLines = envContent.split('\n').filter(line => 
    line.includes('SESSION_') && !line.startsWith('#')
  );
  sessionLines.forEach(line => console.log(`   ${line}`));
} catch (error) {
  console.log('❌ Could not read .env file:', error.message);
}

// Test 4: Create test recording
console.log('\n🎬 Creating test recording...');
const testData = {
  metadata: {
    sessionId: `test-${Date.now()}`,
    sessionType: 'Practice',
    sessionName: 'Test Session',
    location: 'Test Circuit',
    startTime: new Date().toISOString(),
    duration: 0,
    messageCount: 1
  },
  messages: [
    {
      timestamp: new Date().toISOString(),
      relativeTime: 0,
      type: 'TEST',
      direction: 'incoming',
      data: '{"test": "message"}',
      parsedData: { test: 'message' }
    }
  ]
};

const testFilename = `test-session-${Date.now()}.json`;
const testFilePath = path.join(recordingsDir, testFilename);

try {
  fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
  console.log(`✅ Created test recording: ${testFilename}`);
  
  // Verify file
  const stats = fs.statSync(testFilePath);
  console.log(`   File size: ${stats.size} bytes`);
  console.log(`   Created: ${stats.birthtime}`);
} catch (error) {
  console.log('❌ Failed to create test recording:', error.message);
}

console.log('\n✨ Test completed!');

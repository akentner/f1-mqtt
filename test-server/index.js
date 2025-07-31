const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

/**
 * F1 Mock SignalR Server
 * 
 * This server mimics the F1 Live Timing SignalR API for development and testing purposes.
 * It provides the same endpoints and message format as the official F1 API.
 */
class F1MockServer {
  constructor(options = {}) {
    this.port = options.port || 3001;
    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Map();
    this.messageInterval = null;
    
    // Mock data generators
    this.sessionKey = '9158';
    this.currentLap = 1;
    this.isRaceActive = false;
    
    this.setupExpress();
    this.setupWebSocketServer();
  }

  setupExpress() {
    // Enable CORS for all routes
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // SignalR negotiate endpoint
    this.app.get('/signalr/negotiate', (req, res) => {
      const negotiateResponse = {
        ConnectionToken: uuidv4(),
        ConnectionId: uuidv4(),
        KeepAliveTimeout: 20,
        DisconnectTimeout: 30,
        ConnectionTimeout: 110,
        TryWebSockets: true,
        ProtocolVersion: '1.5',
        TransportConnectTimeout: 5,
        LongPollDelay: 0
      };

      // Set cookie for session management
      res.setHeader('Set-Cookie', [`signalr-session=${negotiateResponse.ConnectionId}; Path=/`]);
      res.json(negotiateResponse);
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connections: this.clients.size,
        isRaceActive: this.isRaceActive
      });
    });

    // Control endpoints for testing
    this.app.post('/control/start-race', (req, res) => {
      this.startRace();
      res.json({ message: 'Race started', isRaceActive: this.isRaceActive });
    });

    this.app.post('/control/stop-race', (req, res) => {
      this.stopRace();
      res.json({ message: 'Race stopped', isRaceActive: this.isRaceActive });
    });

    this.app.post('/control/send-message', (req, res) => {
      const message = req.body.message || 'Test message from control panel';
      this.broadcastRaceControlMessage(message);
      res.json({ message: 'Message sent', content: message });
    });
  }

  setupWebSocketServer() {
    this.server = this.app.listen(this.port, () => {
      console.log(`🏎️  F1 Mock Server running on port ${this.port}`);
      console.log(`📡 SignalR negotiate: http://localhost:${this.port}/signalr/negotiate`);
      console.log(`🔗 WebSocket endpoint: ws://localhost:${this.port}/signalr/connect`);
      console.log(`💚 Health check: http://localhost:${this.port}/health`);
      console.log(`🎮 Control panel: http://localhost:${this.port}/control/*`);
    });

    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/signalr/connect'
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      const connectionToken = urlParams.get('connectionToken');
      
      console.log(`🔌 Client connected: ${clientId} (token: ${connectionToken?.substring(0, 8)}...)`);
      
      this.clients.set(clientId, {
        ws,
        connectionToken,
        subscribedStreams: [],
        connectedAt: new Date()
      });

      // Send initial connection message
      this.sendMessage(ws, { C: 'd-1234,0' });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`❌ Error parsing client message:`, error.message);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error.message);
        this.clients.delete(clientId);
      });
    });
  }

  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`📨 Message from ${clientId}:`, JSON.stringify(message));

    // Handle subscription messages
    if (message.H === 'Streaming' && message.M === 'Subscribe' && message.A) {
      const streams = message.A[0] || [];
      client.subscribedStreams = streams;
      
      console.log(`📡 Client ${clientId} subscribed to ${streams.length} streams:`, streams);
      
      // Send subscription confirmation
      this.sendMessage(client.ws, { R: { Response: 'Subscribed' }, I: message.I });
      
      // Send initial data for subscribed streams
      this.sendInitialData(client);
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendInitialData(client) {
    const initialData = {};

    if (client.subscribedStreams.includes('SessionInfo')) {
      initialData.SessionInfo = {
        Meeting: {
          Key: 1219,
          Name: "Test Grand Prix",
          OfficialName: "FORMULA 1 TEST GRAND PRIX 2024",
          Location: "Test Circuit",
          Country: { Key: 'TEST', Code: 'TST', Name: 'Test Country' },
          Circuit: { Key: 'test', ShortName: 'Test Circuit' }
        },
        ArchiveStatus: { Status: 'Live' },
        Key: this.sessionKey,
        Type: 'Race',
        Name: 'Race',
        StartDate: new Date().toISOString(),
        EndDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      };
    }

    if (client.subscribedStreams.includes('TrackStatus')) {
      initialData.TrackStatus = {
        Status: this.isRaceActive ? '1' : '4', // 1 = Green, 4 = Red
        Message: this.isRaceActive ? 'Green Flag' : 'Session Not Started'
      };
    }

    if (client.subscribedStreams.includes('DriverList')) {
      initialData.DriverList = this.generateDriverList();
    }

    if (client.subscribedStreams.includes('RaceControlMessages')) {
      initialData.RaceControlMessages = {
        Messages: this.generateRaceControlMessages()
      };
    }

    if (Object.keys(initialData).length > 0) {
      this.sendMessage(client.ws, { R: initialData });
    }
  }

  generateDriverList() {
    return {
      '1': { RacingNumber: '1', BroadcastName: 'VER', TeamName: 'Red Bull Racing Honda RBPT', TeamColour: '3671C6', FirstName: 'Max', LastName: 'Verstappen', Reference: 'MAXVER01' },
      '11': { RacingNumber: '11', BroadcastName: 'PER', TeamName: 'Red Bull Racing Honda RBPT', TeamColour: '3671C6', FirstName: 'Sergio', LastName: 'Perez', Reference: 'SERPER01' },
      '44': { RacingNumber: '44', BroadcastName: 'HAM', TeamName: 'Mercedes', TeamColour: '6CD3BF', FirstName: 'Lewis', LastName: 'Hamilton', Reference: 'LEWHAM01' },
      '63': { RacingNumber: '63', BroadcastName: 'RUS', TeamName: 'Mercedes', TeamColour: '6CD3BF', FirstName: 'George', LastName: 'Russell', Reference: 'GEORUS01' },
      '16': { RacingNumber: '16', BroadcastName: 'LEC', TeamName: 'Ferrari', TeamColour: 'E8002D', FirstName: 'Charles', LastName: 'Leclerc', Reference: 'CHALEC01' },
      '55': { RacingNumber: '55', BroadcastName: 'SAI', TeamName: 'Ferrari', TeamColour: 'E8002D', FirstName: 'Carlos', LastName: 'Sainz', Reference: 'CARSAI01' }
    };
  }

  generateRaceControlMessages() {
    const messages = {
      '1': { Utc: new Date().toISOString(), Lap: null, Category: 'Other', Message: 'WELCOME TO THE F1 TEST SESSION', Status: null, Flag: null, Scope: null, Sector: null, RacingNumber: null },
      '2': { Utc: new Date().toISOString(), Lap: null, Category: 'Other', Message: 'TRACK CONDITIONS: DRY', Status: null, Flag: null, Scope: null, Sector: null, RacingNumber: null }
    };

    if (this.isRaceActive) {
      messages['3'] = { Utc: new Date().toISOString(), Lap: this.currentLap, Category: 'Flag', Message: 'GREEN FLAG', Status: null, Flag: 'GREEN', Scope: 'Track', Sector: null, RacingNumber: null };
    }

    return messages;
  }

  startRace() {
    this.isRaceActive = true;
    console.log('🏁 Race started - sending live data');
    
    // Broadcast race start message
    this.broadcastRaceControlMessage('LIGHTS OUT AND AWAY WE GO!');
    this.broadcastTrackStatus('1', 'Green Flag');
    
    // Start sending periodic updates
    this.startPeriodicUpdates();
  }

  stopRace() {
    this.isRaceActive = false;
    console.log('🏁 Race stopped');
    
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
    
    this.broadcastRaceControlMessage('SESSION STOPPED');
    this.broadcastTrackStatus('4', 'Session Stopped');
  }

  startPeriodicUpdates() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }

    // Send updates every 5 seconds during race
    this.messageInterval = setInterval(() => {
      if (this.isRaceActive) {
        this.sendLiveUpdates();
      }
    }, 5000);
  }

  sendLiveUpdates() {
    // Simulate timing data
    this.broadcastTimingData();
    
    // Occasionally send race control messages
    if (Math.random() < 0.1) { // 10% chance per update
      const messages = [
        'DRS ENABLED',
        'VIRTUAL SAFETY CAR DEPLOYED',
        'VIRTUAL SAFETY CAR ENDING',
        'YELLOW FLAG SECTOR 2',
        'CLEAR IN SECTOR 2'
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      this.broadcastRaceControlMessage(randomMessage);
    }

    // Increment lap occasionally
    if (Math.random() < 0.05) { // 5% chance per update
      this.currentLap++;
      this.broadcastRaceControlMessage(`LAP ${this.currentLap} COMPLETED`);
    }
  }

  broadcastTimingData() {
    const timingData = {
      Lines: {}
    };

    // Generate mock timing for first 6 drivers
    const drivers = ['1', '11', '44', '63', '16', '55'];
    drivers.forEach((driverNumber, index) => {
      const position = index + 1;
      const lastLapTime = this.generateLapTime(position);
      const bestLapTime = this.generateBestLapTime(position);
      
      timingData.Lines[driverNumber] = {
        RacingNumber: driverNumber,
        Position: position.toString(),
        ShowPosition: true,
        BestLapTime: {
          Value: bestLapTime,
          Lap: Math.floor(Math.random() * this.currentLap) + 1
        },
        LastLapTime: {
          Value: lastLapTime,
          Status: position <= 3 ? 'PERSONAL_BEST' : 'NORMAL'
        },
        NumberOfLaps: this.currentLap,
        Retired: false,
        InPit: Math.random() < 0.1, // 10% chance of being in pit
        PitOut: false,
        Stopped: false,
        Status: 'OnTrack'
      };
    });

    this.broadcastToSubscribers('TimingData', timingData);
  }

  generateLapTime(position) {
    // Base time around 1:30.000, faster for better positions
    const baseTime = 90000; // milliseconds
    const positionPenalty = (position - 1) * 200; // 0.2s per position
    const randomVariation = Math.random() * 1000; // up to 1s variation
    
    const totalMs = baseTime + positionPenalty + randomVariation;
    return this.formatLapTime(totalMs);
  }

  generateBestLapTime(position) {
    // Slightly faster than current lap times
    const baseTime = 89000; // milliseconds
    const positionPenalty = (position - 1) * 150;
    const randomVariation = Math.random() * 500;
    
    const totalMs = baseTime + positionPenalty + randomVariation;
    return this.formatLapTime(totalMs);
  }

  formatLapTime(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  broadcastRaceControlMessage(message) {
    const messageData = {
      Messages: {
        [Date.now()]: {
          Utc: new Date().toISOString(),
          Lap: this.isRaceActive ? this.currentLap : null,
          Category: 'Other',
          Message: message,
          Status: null,
          Flag: null,
          Scope: null,
          Sector: null,
          RacingNumber: null
        }
      }
    };

    this.broadcastToSubscribers('RaceControlMessages', messageData);
  }

  broadcastTrackStatus(status, message) {
    const statusData = {
      Status: status,
      Message: message
    };

    this.broadcastToSubscribers('TrackStatus', statusData);
  }

  broadcastToSubscribers(streamName, data) {
    this.clients.forEach((client, clientId) => {
      if (client.subscribedStreams.includes(streamName)) {
        const message = {
          M: [{
            M: 'feed',
            A: [streamName, data],
            I: Date.now()
          }]
        };
        this.sendMessage(client.ws, message);
      }
    });
  }

  stop() {
    console.log('🛑 Stopping F1 Mock Server...');
    
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    
    // Close all WebSocket connections
    this.clients.forEach((client) => {
      client.ws.close();
    });
    
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    console.log('✅ F1 Mock Server stopped');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new F1MockServer({ port: process.env.PORT || 3001 });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}

module.exports = F1MockServer;

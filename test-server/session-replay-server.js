const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class SessionReplayServer {
  constructor(recordingPath = '../recordings') {
    this.recordingPath = path.resolve(__dirname, recordingPath);
    this.app = express();
    this.server = null;
    this.wss = null;
    this.currentReplay = null;
    this.replayClients = new Set();
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Enable CORS for all routes
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // List available recordings
    this.app.get('/recordings', (req, res) => {
      try {
        if (!fs.existsSync(this.recordingPath)) {
          return res.json([]);
        }

        const recordings = fs.readdirSync(this.recordingPath)
          .filter(file => file.endsWith('.json'))
          .map(filename => {
            const filePath = path.join(this.recordingPath, filename);
            const stats = fs.statSync(filePath);
            
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const recording = JSON.parse(content);
              
              return {
                filename,
                metadata: recording.metadata,
                fileSize: stats.size,
                lastModified: stats.mtime,
              };
            } catch (error) {
              return {
                filename,
                error: 'Failed to parse recording',
                fileSize: stats.size,
                lastModified: stats.mtime,
              };
            }
          })
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        res.json(recordings);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get recording details
    this.app.get('/recordings/:filename', (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.recordingPath, filename);
        
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'Recording not found' });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const recording = JSON.parse(content);
        
        res.json(recording);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Start replay
    this.app.post('/replay/:filename', (req, res) => {
      try {
        const filename = req.params.filename;
        const options = req.body || {};
        
        const result = this.startReplay(filename, options);
        
        if (result.success) {
          res.json({ 
            message: 'Replay started successfully',
            sessionId: result.sessionId,
            messageCount: result.messageCount,
            duration: result.duration
          });
        } else {
          res.status(400).json({ error: result.error });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Stop replay
    this.app.post('/replay/stop', (req, res) => {
      if (this.currentReplay) {
        this.stopReplay();
        res.json({ message: 'Replay stopped successfully' });
      } else {
        res.json({ message: 'No active replay to stop' });
      }
    });

    // Get replay status
    this.app.get('/replay/status', (req, res) => {
      if (this.currentReplay) {
        res.json({
          active: true,
          sessionId: this.currentReplay.sessionId,
          currentMessage: this.currentReplay.currentMessageIndex,
          totalMessages: this.currentReplay.messages.length,
          elapsedTime: Date.now() - this.currentReplay.startTime,
          playbackSpeed: this.currentReplay.playbackSpeed,
          clients: this.replayClients.size,
        });
      } else {
        res.json({ active: false });
      }
    });

    // Control panel
    this.app.get('/control', (req, res) => {
      res.send(this.generateControlPanel());
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        recordingPath: this.recordingPath,
        hasRecordings: fs.existsSync(this.recordingPath),
        activeReplay: !!this.currentReplay,
        connectedClients: this.replayClients.size,
      });
    });
  }

  startReplay(filename, options = {}) {
    if (this.currentReplay) {
      this.stopReplay();
    }

    try {
      const filePath = path.join(this.recordingPath, filename);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Recording file not found' };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const recording = JSON.parse(content);

      if (!recording.messages || recording.messages.length === 0) {
        return { success: false, error: 'No messages found in recording' };
      }

      this.currentReplay = {
        sessionId: recording.metadata.sessionId,
        messages: recording.messages.filter(msg => msg.direction === 'incoming'),
        currentMessageIndex: 0,
        startTime: Date.now(),
        playbackSpeed: options.speed || 1.0,
        loop: options.loop || false,
        timer: null,
      };

      console.log(`🎬 Starting replay of session: ${recording.metadata.sessionName}`);
      console.log(`📊 Messages to replay: ${this.currentReplay.messages.length}`);
      console.log(`⚡ Playback speed: ${this.currentReplay.playbackSpeed}x`);

      this.scheduleNextMessage();

      return {
        success: true,
        sessionId: this.currentReplay.sessionId,
        messageCount: this.currentReplay.messages.length,
        duration: recording.metadata.duration,
      };

    } catch (error) {
      return { success: false, error: `Failed to load recording: ${error.message}` };
    }
  }

  scheduleNextMessage() {
    if (!this.currentReplay || this.currentReplay.currentMessageIndex >= this.currentReplay.messages.length) {
      if (this.currentReplay && this.currentReplay.loop) {
        console.log('🔄 Looping replay...');
        this.currentReplay.currentMessageIndex = 0;
        this.currentReplay.startTime = Date.now();
      } else {
        console.log('✅ Replay completed');
        this.stopReplay();
        return;
      }
    }

    const currentMessage = this.currentReplay.messages[this.currentReplay.currentMessageIndex];
    const nextMessage = this.currentReplay.messages[this.currentReplay.currentMessageIndex + 1];

    // Send current message to all connected clients
    this.broadcastMessage(currentMessage);

    this.currentReplay.currentMessageIndex++;

    // Schedule next message
    if (nextMessage) {
      const delay = (nextMessage.relativeTime - currentMessage.relativeTime) / this.currentReplay.playbackSpeed;
      this.currentReplay.timer = setTimeout(() => {
        this.scheduleNextMessage();
      }, Math.max(1, delay)); // Minimum 1ms delay
    } else {
      // No more messages, check if we should loop
      this.scheduleNextMessage();
    }
  }

  broadcastMessage(message) {
    if (this.replayClients.size === 0) {
      return;
    }

    const messageToSend = message.rawMessage;
    
    this.replayClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageToSend);
        } catch (error) {
          console.error('Failed to send message to client:', error.message);
          this.replayClients.delete(client);
        }
      }
    });

    console.log(`📤 Replayed message ${this.currentReplay.currentMessageIndex}/${this.currentReplay.messages.length}: ${message.messageType} (${message.dataSize}B)`);
  }

  stopReplay() {
    if (this.currentReplay) {
      if (this.currentReplay.timer) {
        clearTimeout(this.currentReplay.timer);
      }
      console.log('⏹️  Replay stopped');
      this.currentReplay = null;
    }
  }

  setupWebSocket(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      console.log('🔗 Client connected for replay');
      this.replayClients.add(ws);

      // Send initial connection message
      ws.send(JSON.stringify({ C: "replay-ready" }));

      ws.on('close', () => {
        console.log('🔌 Client disconnected from replay');
        this.replayClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        this.replayClients.delete(ws);
      });

      // Handle subscription message (compatibility with SignalR client)
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.M === 'Subscribe') {
            console.log('📡 Client subscribed to replay data');
            ws.send(JSON.stringify({ R: { Response: "Subscribed" }, I: message.I || 1 }));
          }
        } catch (error) {
          console.log('📥 Non-JSON message received:', data.toString());
        }
      });
    });
  }

  generateControlPanel() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>F1 Session Replay Control</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #e10600; }
        .section { background: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .recording { padding: 15px; margin: 10px 0; background: #3a3a3a; border-radius: 5px; }
        .recording h3 { margin: 0 0 10px 0; color: #e10600; }
        .metadata { font-size: 0.9em; color: #ccc; }
        .controls { margin: 15px 0; }
        button { background: #e10600; color: white; border: none; padding: 10px 15px; margin: 5px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #c70500; }
        button:disabled { background: #666; cursor: not-allowed; }
        .status { padding: 10px; background: #0a3d0a; border-radius: 5px; margin: 10px 0; }
        .status.inactive { background: #3d0a0a; }
        input, select { padding: 5px; margin: 5px; border-radius: 3px; border: 1px solid #555; background: #4a4a4a; color: #fff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏎️ F1 Session Replay Control</h1>
            <p>Replay recorded F1 sessions for development and testing</p>
        </div>

        <div class="section">
            <h2>📊 Replay Status</h2>
            <div id="status" class="status inactive">
                <strong>Status:</strong> <span id="statusText">No active replay</span><br>
                <span id="statusDetails"></span>
            </div>
            <div class="controls">
                <button onclick="stopReplay()">⏹️ Stop Replay</button>
                <button onclick="refreshStatus()">🔄 Refresh Status</button>
            </div>
        </div>

        <div class="section">
            <h2>📁 Available Recordings</h2>
            <div id="recordings">Loading recordings...</div>
        </div>
    </div>

    <script>
        function loadRecordings() {
            fetch('/recordings')
                .then(response => response.json())
                .then(recordings => {
                    const container = document.getElementById('recordings');
                    if (recordings.length === 0) {
                        container.innerHTML = '<p>No recordings found. Record a session first!</p>';
                        return;
                    }
                    
                    container.innerHTML = recordings.map(rec => \`
                        <div class="recording">
                            <h3>\${rec.metadata?.sessionName || rec.filename}</h3>
                            <div class="metadata">
                                <strong>Type:</strong> \${rec.metadata?.sessionType || 'Unknown'}<br>
                                <strong>Location:</strong> \${rec.metadata?.location || 'Unknown'}<br>
                                <strong>Duration:</strong> \${rec.metadata?.duration ? Math.round(rec.metadata.duration / 1000) + 's' : 'Unknown'}<br>
                                <strong>Messages:</strong> \${rec.metadata?.messageCount || 0}<br>
                                <strong>File Size:</strong> \${Math.round(rec.fileSize / 1024)}KB<br>
                                <strong>Recorded:</strong> \${new Date(rec.metadata?.startTime || rec.lastModified).toLocaleString()}<br>
                                <strong>File:</strong> \${rec.filename}
                            </div>
                            <div class="controls">
                                <button onclick="startReplay('\${rec.filename}', 1.0)">▶️ Play 1x</button>
                                <button onclick="startReplay('\${rec.filename}', 2.0)">⏩ Play 2x</button>
                                <button onclick="startReplay('\${rec.filename}', 0.5)">🐌 Play 0.5x</button>
                                <button onclick="startReplayLoop('\${rec.filename}')">🔄 Loop</button>
                            </div>
                        </div>
                    \`).join('');
                })
                .catch(error => {
                    document.getElementById('recordings').innerHTML = \`<p>Error loading recordings: \${error.message}</p>\`;
                });
        }

        function startReplay(filename, speed = 1.0, loop = false) {
            fetch(\`/replay/\${filename}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ speed, loop })
            })
            .then(response => response.json())
            .then(result => {
                if (result.error) {
                    alert('Error: ' + result.error);
                } else {
                    alert('Replay started: ' + result.message);
                    refreshStatus();
                }
            })
            .catch(error => {
                alert('Error starting replay: ' + error.message);
            });
        }

        function startReplayLoop(filename) {
            startReplay(filename, 1.0, true);
        }

        function stopReplay() {
            fetch('/replay/stop', { method: 'POST' })
                .then(response => response.json())
                .then(result => {
                    alert(result.message);
                    refreshStatus();
                })
                .catch(error => {
                    alert('Error stopping replay: ' + error.message);
                });
        }

        function refreshStatus() {
            fetch('/replay/status')
                .then(response => response.json())
                .then(status => {
                    const statusDiv = document.getElementById('status');
                    const statusText = document.getElementById('statusText');
                    const statusDetails = document.getElementById('statusDetails');
                    
                    if (status.active) {
                        statusDiv.className = 'status';
                        statusText.textContent = 'Active Replay';
                        statusDetails.innerHTML = \`
                            <strong>Session:</strong> \${status.sessionId}<br>
                            <strong>Progress:</strong> \${status.currentMessage}/\${status.totalMessages} messages<br>
                            <strong>Elapsed:</strong> \${Math.round(status.elapsedTime / 1000)}s<br>
                            <strong>Speed:</strong> \${status.playbackSpeed}x<br>
                            <strong>Clients:</strong> \${status.clients}
                        \`;
                    } else {
                        statusDiv.className = 'status inactive';
                        statusText.textContent = 'No active replay';
                        statusDetails.innerHTML = '';
                    }
                });
        }

        // Load recordings on page load
        loadRecordings();
        refreshStatus();

        // Auto-refresh status every 2 seconds
        setInterval(refreshStatus, 2000);
    </script>
</body>
</html>
    `;
  }

  start(port = 3002) {
    this.server = this.app.listen(port, () => {
      console.log(`🎬 F1 Session Replay Server running on port ${port}`);
      console.log(`📁 Recording path: ${this.recordingPath}`);
      console.log(`🎮 Control panel: http://localhost:${port}/control`);
      console.log(`💚 Health check: http://localhost:${port}/health`);
    });

    this.setupWebSocket(this.server);
    return this.server;
  }

  stop() {
    this.stopReplay();
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = { SessionReplayServer };

// Start server if run directly
if (require.main === module) {
  const server = new SessionReplayServer();
  server.start(3002);
}

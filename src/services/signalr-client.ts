import { EventEmitter } from 'events';
import WebSocket from 'ws';
import https from 'https';
import { SignalRConfig, F1Event } from '../types';
import { logger } from '../utils/logger';

// SignalR Client Default Values
const SIGNALR_DEFAULTS = {
  // Connection settings
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MS: 2000,
  MAX_EVENT_LISTENERS: 20,

  // Buffer and memory management
  MAX_BUFFER_SIZE: 100,
  BUFFER_KEEP_SIZE: 50,
  MEMORY_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes

  // Protocol settings
  CLIENT_PROTOCOL: '1.5',
  TRANSPORT: 'webSockets',

  // Timeouts
  REQUEST_TIMEOUT_MS: 10000,
  WEBSOCKET_TIMEOUT_MS: 10000,

  // HTTP Headers
  USER_AGENT: 'BestHTTP',
  ACCEPT_ENCODING: 'gzip,identity',

  // Message size limits
  MESSAGE_TRUNCATE_SIZE: 1000,
  DEBUG_PREVIEW_SIZE: 100,
  PARSE_ERROR_PREVIEW_SIZE: 200,
  LARGE_PAYLOAD_THRESHOLD: 500,

  // F1 Live Timing API endpoints
  NEGOTIATE_URL: 'https://livetiming.formula1.com/signalr/negotiate',
  CONNECT_URL: 'wss://livetiming.formula1.com/signalr/connect',
  HUB_DATA: '[{"name":"Streaming"}]',
} as const;

interface NegotiateResponse {
  ConnectionToken: string;
  ConnectionId: string;
  KeepAliveTimeout: number;
  DisconnectTimeout: number;
  ConnectionTimeout: number;
  TryWebSockets: boolean;
  ProtocolVersion: string;
  TransportConnectTimeout: number;
  LongPollDelay: number;
}

export class SignalRClient extends EventEmitter {
  private config: SignalRConfig;
  private ws: WebSocket | null = null;
  private connectionToken: string | null = null;
  private cookie: string | null = null;
  private isConnectedState = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = SIGNALR_DEFAULTS.MAX_RECONNECT_ATTEMPTS;
  private reconnectDelay = SIGNALR_DEFAULTS.RECONNECT_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private memoryCleanupTimer: NodeJS.Timeout | null = null;
  private messageBuffer: string[] = [];
  private readonly MAX_BUFFER_SIZE = SIGNALR_DEFAULTS.MAX_BUFFER_SIZE;

  // F1 Live Timing API endpoints
  private readonly NEGOTIATE_URL = SIGNALR_DEFAULTS.NEGOTIATE_URL;
  private readonly CONNECT_URL = SIGNALR_DEFAULTS.CONNECT_URL;
  private readonly HUB_DATA = SIGNALR_DEFAULTS.HUB_DATA;

  constructor(config: SignalRConfig) {
    super();
    this.config = config;

    // Prevent memory leaks from EventEmitter
    this.setMaxListeners(SIGNALR_DEFAULTS.MAX_EVENT_LISTENERS);

    // Start periodic memory cleanup
    this.startMemoryCleanup();
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to F1 SignalR service...');

      // Step 1: Negotiate connection
      await this.negotiate();

      // Step 2: Establish WebSocket connection
      await this.connectWebSocket();

      // Step 3: Subscribe to streams
      await this.subscribe();

      this.isConnectedState = true;
      this.reconnectAttempts = 0;

      logger.info('Connected to F1 SignalR service', {
        connectionToken: this.connectionToken?.substring(0, 20) + '...',
      });

      this.emit('connected');
    } catch (error) {
      logger.error('Failed to connect to F1 SignalR service', {
        error: (error as Error).message,
      });

      this.isConnectedState = false;
      this.reconnectAttempts++;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay =
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        logger.info(
          `Retrying connection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      } else {
        this.emit('connectionFailed', error);
      }

      throw error;
    }
  }

  private startMemoryCleanup(): void {
    // Cleanup memory every 5 minutes
    this.memoryCleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, SIGNALR_DEFAULTS.MEMORY_CLEANUP_INTERVAL_MS);
  }

  private performMemoryCleanup(): void {
    try {
      // Clear message buffer if it gets too large
      if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
        this.messageBuffer = this.messageBuffer.slice(
          -SIGNALR_DEFAULTS.BUFFER_KEEP_SIZE
        ); // Keep only last 50
        logger.debug('🧹 Cleaned up message buffer', {
          newSize: this.messageBuffer.length,
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.debug('🗑️ Forced garbage collection');
      }

      // Log current memory usage
      const memUsage = process.memoryUsage();
      logger.debug('💾 Memory usage after cleanup', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      });
    } catch (error) {
      logger.warn('Memory cleanup failed', {
        error: (error as Error).message,
      });
    }
  }

  private async negotiate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        clientProtocol: SIGNALR_DEFAULTS.CLIENT_PROTOCOL,
        connectionData: this.HUB_DATA,
      });

      const url = `${this.NEGOTIATE_URL}?${params.toString()}`;

      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': SIGNALR_DEFAULTS.USER_AGENT,
            'Accept-Encoding': SIGNALR_DEFAULTS.ACCEPT_ENCODING,
          },
        },
        (res) => {
          let data = '';

          // Extract cookie from response headers
          const setCookie = res.headers['set-cookie'];
          if (setCookie && setCookie.length > 0) {
            this.cookie = setCookie[0] || null;
          }

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const response: NegotiateResponse = JSON.parse(data);
              this.connectionToken = response.ConnectionToken;
              logger.debug('Negotiation successful', {
                connectionId: response.ConnectionId,
                protocolVersion: response.ProtocolVersion,
              });
              resolve();
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse negotiate response: ${(error as Error).message}`
                )
              );
            }
          });
        }
      );

      req.on('error', (error) => {
        reject(new Error(`Negotiate request failed: ${error.message}`));
      });

      req.setTimeout(SIGNALR_DEFAULTS.REQUEST_TIMEOUT_MS, () => {
        req.destroy();
        reject(new Error('Negotiate request timeout'));
      });
    });
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connectionToken) {
        reject(new Error('No connection token available'));
        return;
      }

      const params = new URLSearchParams({
        transport: SIGNALR_DEFAULTS.TRANSPORT,
        clientProtocol: SIGNALR_DEFAULTS.CLIENT_PROTOCOL,
        connectionToken: this.connectionToken,
        connectionData: this.HUB_DATA,
      });

      const url = `${this.CONNECT_URL}?${params.toString()}`;

      const headers: Record<string, string> = {
        'User-Agent': SIGNALR_DEFAULTS.USER_AGENT,
        'Accept-Encoding': SIGNALR_DEFAULTS.ACCEPT_ENCODING,
      };

      if (this.cookie) {
        headers['Cookie'] = this.cookie;
      }

      this.ws = new WebSocket(url, { headers });

      this.ws.on('open', () => {
        logger.debug('🔌 WebSocket connection established');
        logger.info('WebSocket connection opened', {
          url: url.substring(0, SIGNALR_DEFAULTS.DEBUG_PREVIEW_SIZE) + '...',
          readyState: this.ws?.readyState,
        });
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const rawMessage = data.toString();
        logger.debug('📥 Raw WebSocket Message Received', {
          messageLength: rawMessage.length,
          messagePreview: rawMessage.substring(
            0,
            SIGNALR_DEFAULTS.DEBUG_PREVIEW_SIZE
          ),
          timestamp: new Date().toISOString(),
        });
        this.handleMessage(rawMessage);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        logger.warn('WebSocket connection closed', {
          code,
          reason: reason.toString(),
        });
        this.isConnectedState = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error: Error) => {
        logger.error('WebSocket error', { error: error.message });
        this.isConnectedState = false;
        reject(error);
      });

      // Timeout for WebSocket connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, SIGNALR_DEFAULTS.WEBSOCKET_TIMEOUT_MS);
    });
  }

  private async subscribe(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const subscribeMsg = {
      H: 'Streaming',
      M: 'Subscribe',
      A: [
        [
          'RaceControlMessages',
          // 'TimingData',
          // 'CarData.z',
          // 'Position.z',
          // 'ExtrapolatedClock',
          // 'TopThree',
          // 'RcmSeries',
          // 'TimingStats',
          // 'TimingAppData',
          // 'WeatherData',
          'TrackStatus',
          // 'DriverList',
          // 'SessionInfo',
          // 'SessionData',
          // 'LapCount',
        ],
      ],
      I: 1,
    };

    const subscribeString = JSON.stringify(subscribeMsg);

    logger.debug('📤 Sending F1 Subscribe Message', {
      subscribeMessage: subscribeString,
      streamCount: subscribeMsg.A[0]?.length || 0,
      streams: subscribeMsg.A[0],
    });

    this.ws.send(subscribeString);
    logger.info('Subscribed to F1 data streams', {
      streamCount: subscribeMsg.A[0]?.length || 0,
    });
  }

  private handleMessage(data: string): void {
    try {
      // Add to message buffer for debugging (with size limit)
      this.messageBuffer.push(data);
      if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
        this.messageBuffer.shift(); // Remove oldest message
      }

      // Log raw SignalR message (but limit data size to prevent memory issues)
      const truncatedData =
        data.length > SIGNALR_DEFAULTS.MESSAGE_TRUNCATE_SIZE
          ? data.substring(0, SIGNALR_DEFAULTS.MESSAGE_TRUNCATE_SIZE) + '...'
          : data;
      logger.debug('📨 RAW SignalR Message', {
        rawData: truncatedData,
        dataLength: data.length,
        timestamp: new Date().toISOString(),
      });

      // Parse with error boundary to prevent memory leaks from malformed JSON
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch (parseError) {
        logger.warn('Failed to parse SignalR message', {
          error: (parseError as Error).message,
          dataPreview: data.substring(
            0,
            SIGNALR_DEFAULTS.PARSE_ERROR_PREVIEW_SIZE
          ),
        });
        return;
      }

      // Log parsed payload structure (with size limits)
      logger.debug('📋 Parsed SignalR Payload', {
        payloadType: typeof payload,
        payloadKeys:
          typeof payload === 'object' && payload !== null
            ? Object.keys(payload)
            : 'not-object',
        hasM: payload && typeof payload === 'object' && 'M' in payload,
        hasR: payload && typeof payload === 'object' && 'R' in payload,
        hasC: payload && typeof payload === 'object' && 'C' in payload,
        hasS: payload && typeof payload === 'object' && 'S' in payload,
        hasI: payload && typeof payload === 'object' && 'I' in payload,
        // Only include full payload in debug if it's small
        fullPayload:
          JSON.stringify(payload).length <
          SIGNALR_DEFAULTS.LARGE_PAYLOAD_THRESHOLD
            ? JSON.stringify(payload, null, 2)
            : '[Large payload omitted]',
      });

      // Handle hub messages (M property)
      if (payload.M && Array.isArray(payload.M)) {
        logger.debug('🔄 Processing Hub Messages (M)', {
          messageCount: payload.M.length,
          messages: payload.M.map((msg: Record<string, unknown>) => ({
            method: msg.M,
            hasArgs: 'A' in msg,
            argCount: msg.A && Array.isArray(msg.A) ? msg.A.length : 0,
          })),
        });

        for (const hubMsg of payload.M) {
          if (
            typeof hubMsg === 'object' &&
            hubMsg !== null &&
            (hubMsg as Record<string, unknown>).M === 'feed'
          ) {
            this.processFeedMessage(hubMsg as Record<string, unknown>);
          }
        }
      }

      // Handle response messages (R property)
      if (payload.R && typeof payload.R === 'object' && payload.R !== null) {
        logger.debug('📊 Processing Response Messages (R)', {
          responseKeys: Object.keys(payload.R),
          responseData:
            JSON.stringify(payload.R).length <
            SIGNALR_DEFAULTS.LARGE_PAYLOAD_THRESHOLD
              ? JSON.stringify(payload.R, null, 2)
              : '[Large response omitted]',
        });
        this.processResponseMessage(payload.R as Record<string, unknown>);
      }

      // Handle other SignalR protocol messages
      if (payload.C) {
        logger.debug('🔗 SignalR Connection Message', {
          connectionData: payload.C,
        });
      }

      if (payload.S) {
        logger.debug('⚡ SignalR State Message', { state: payload.S });
      }

      if (payload.I) {
        logger.debug('🆔 SignalR Identifier', { identifier: payload.I });
      }
    } catch (error) {
      logger.error('❌ Failed to parse SignalR message', {
        error: (error as Error).message,
        rawData: data.substring(0, SIGNALR_DEFAULTS.LARGE_PAYLOAD_THRESHOLD),
        dataLength: data.length,
        stack: (error as Error).stack,
      });
    }
  }

  private processFeedMessage(hubMsg: Record<string, unknown>): void {
    const args = hubMsg.A as unknown[];
    if (!args || args.length < 2) {
      logger.debug('🚫 Invalid feed message - insufficient args', {
        hubMsg: JSON.stringify(hubMsg),
        argsLength: args?.length || 0,
      });
      return;
    }

    const streamName = args[0] as string;
    const streamData = args[1] as Record<string, unknown>;

    logger.debug('🎯 Processing Feed Message', {
      streamName,
      streamDataType: typeof streamData,
      streamDataKeys:
        typeof streamData === 'object' ? Object.keys(streamData) : 'not-object',
      rawStreamData: JSON.stringify(streamData, null, 2),
      hubMessageFull: JSON.stringify(hubMsg, null, 2),
    });

    if (!streamName || !streamData) {
      logger.debug('🚫 Invalid feed message - missing data', {
        streamName,
        hasStreamData: !!streamData,
      });
      return;
    }

    const event: F1Event = {
      eventType: streamName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      timestamp: new Date().toISOString(),
      data: streamData,
    };

    logger.debug('🚀 Emitting F1 Event', {
      eventType: event.eventType,
      originalStreamName: streamName,
      dataSize: JSON.stringify(streamData).length,
      timestamp: event.timestamp,
    });

    this.emit('event', event);
  }

  private processResponseMessage(response: Record<string, unknown>): void {
    logger.debug('📈 Processing Response Message Details', {
      responseEntries: Object.entries(response).length,
      responseKeys: Object.keys(response),
      fullResponse: JSON.stringify(response, null, 2),
    });

    for (const [streamName, streamData] of Object.entries(response)) {
      logger.debug('🔄 Processing Response Entry', {
        streamName,
        streamDataType: typeof streamData,
        streamDataPreview: JSON.stringify(streamData).substring(
          0,
          SIGNALR_DEFAULTS.PARSE_ERROR_PREVIEW_SIZE
        ),
      });

      const event: F1Event = {
        eventType: streamName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        timestamp: new Date().toISOString(),
        data: streamData as Record<string, unknown>,
      };

      logger.debug('🚀 Emitting Response Event', {
        eventType: event.eventType,
        originalStreamName: streamName,
      });

      this.emit('event', event);
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Clear all timers to prevent memory leaks
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (this.memoryCleanupTimer) {
        clearInterval(this.memoryCleanupTimer);
        this.memoryCleanupTimer = null;
      }

      // Close WebSocket connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      // Clear connection state
      this.isConnectedState = false;
      this.connectionToken = null;
      this.cookie = null;

      // Clear message buffer
      this.messageBuffer = [];

      // Remove all event listeners to prevent memory leaks
      this.removeAllListeners();

      // Final memory cleanup
      this.performMemoryCleanup();

      logger.info(
        'Disconnected from F1 SignalR service and cleaned up resources'
      );
      this.emit('disconnected');
    } catch (error) {
      logger.error('Error disconnecting from F1 SignalR service', {
        error: (error as Error).message,
      });
    }
  }

  isConnected(): boolean {
    return this.isConnectedState && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string | null {
    if (!this.ws) return 'Disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'Connecting';
      case WebSocket.OPEN:
        return 'Connected';
      case WebSocket.CLOSING:
        return 'Closing';
      case WebSocket.CLOSED:
        return 'Closed';
      default:
        return 'Unknown';
    }
  }
}

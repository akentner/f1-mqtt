import { EventEmitter } from 'events';
import WebSocket from 'ws';
import https from 'https';
import http from 'http';
import { SignalRConfig, F1Event } from '../types';
import { logger } from '../utils/logger';
import globalConfig from '../config';
import { SignalRMessageLogger } from './signalr-message-logger';
import { SessionRecorder, SessionRecording } from './session-recorder';

/**
 * F1 Live Timing Stream Types
 *
 * Enumeration of all available F1 Live Timing data streams.
 * Each stream provides different types of real-time race data.
 */
export enum F1Stream {
  // Race Control and Status
  RACE_CONTROL_MESSAGES = 'RaceControlMessages',
  TRACK_STATUS = 'TrackStatus',
  SESSION_INFO = 'SessionInfo',
  SESSION_DATA = 'SessionData',

  // Timing and Position Data
  TIMING_DATA = 'TimingData',
  CAR_DATA = 'CarData.z',
  POSITION = 'Position.z',
  EXTRAPOLATED_CLOCK = 'ExtrapolatedClock',
  LAP_COUNT = 'LapCount',

  // Statistics and Analysis
  TOP_THREE = 'TopThree',
  RCM_SERIES = 'RcmSeries',
  TIMING_STATS = 'TimingStats',
  TIMING_APP_DATA = 'TimingAppData',

  // Additional Data
  WEATHER_DATA = 'WeatherData',
  DRIVER_LIST = 'DriverList',
}

/**
 * Predefined stream sets for different use cases
 *
 * BASIC: Minimal set for basic race monitoring
 * ESSENTIAL: Essential race data for timing and position
 * FULL: Complete data set with all available streams (default)
 * ALL: All available streams (same as FULL currently)
 */
export const F1_STREAM_SETS = {
  // Minimal set for basic race monitoring
  BASIC: [
    F1Stream.RACE_CONTROL_MESSAGES,
    F1Stream.TRACK_STATUS,
    F1Stream.SESSION_DATA,
    F1Stream.SESSION_INFO,
  ],

  // Essential race data
  ESSENTIAL: [
    F1Stream.RACE_CONTROL_MESSAGES,
    F1Stream.TRACK_STATUS,
    // F1Stream.TIMING_DATA,
    // F1Stream.POSITION,
    F1Stream.SESSION_DATA,
    F1Stream.SESSION_INFO,
  ],

  // Full data set
  FULL: [
    F1Stream.RACE_CONTROL_MESSAGES,
    F1Stream.TIMING_DATA,
    // F1Stream.CAR_DATA,
    // F1Stream.POSITION,
    F1Stream.EXTRAPOLATED_CLOCK,
    F1Stream.TOP_THREE,
    F1Stream.RCM_SERIES,
    F1Stream.TIMING_STATS,
    F1Stream.TIMING_APP_DATA,
    F1Stream.WEATHER_DATA,
    F1Stream.TRACK_STATUS,
    F1Stream.DRIVER_LIST,
    F1Stream.SESSION_INFO,
    F1Stream.SESSION_DATA,
    F1Stream.LAP_COUNT,
  ],

  // All available streams
  ALL: Object.values(F1Stream),
} as const;

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

  // F1 Live Timing API endpoints (configurable via environment variables)
  NEGOTIATE_URL:
    globalConfig.signalR.negotiateUrl ||
    'https://livetiming.formula1.com/signalr/negotiate',
  CONNECT_URL:
    globalConfig.signalR.connectUrl ||
    'wss://livetiming.formula1.com/signalr/connect',
  HUB_DATA: '[{"name":"Streaming"}]',

  // F1 Stream Configuration
  DEFAULT_STREAM_SET: F1_STREAM_SETS.FULL,

  // SignalR Protocol
  HUB_NAME: 'Streaming',
  SUBSCRIBE_METHOD: 'Subscribe',
  MESSAGE_ID: 1,
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
  private currentStreamSet: readonly string[] =
    SIGNALR_DEFAULTS.DEFAULT_STREAM_SET;
  private messageLogger: SignalRMessageLogger;
  private sessionRecorder: SessionRecorder;

  // F1 Live Timing API endpoints
  private readonly NEGOTIATE_URL = SIGNALR_DEFAULTS.NEGOTIATE_URL;
  private readonly CONNECT_URL = SIGNALR_DEFAULTS.CONNECT_URL;
  private readonly HUB_DATA = SIGNALR_DEFAULTS.HUB_DATA;

  constructor(config: SignalRConfig) {
    super();
    this.config = config;

    // Initialize message logger with global configuration
    this.messageLogger = new SignalRMessageLogger({
      enabled: globalConfig.signalRMessageLogging.enabled,
      logFilePath: globalConfig.signalRMessageLogging.filePath,
      maxFileSize: globalConfig.signalRMessageLogging.maxFileSize,
      maxFiles: globalConfig.signalRMessageLogging.maxFiles,
    });

    // Initialize session recorder
    this.sessionRecorder = new SessionRecorder({
      enabled: globalConfig.sessionRecording?.enabled ?? false,
      mode: globalConfig.sessionRecording?.mode ?? 'structured',
      recordingPath:
        globalConfig.sessionRecording?.recordingPath ?? './recordings',
      maxRecordingSize:
        globalConfig.sessionRecording?.maxRecordingSize ?? 100 * 1024 * 1024, // 100MB
      autoStart: globalConfig.sessionRecording?.autoStart ?? false,
      sessionDetectionTimeout:
        globalConfig.sessionRecording?.sessionDetectionTimeout ?? 30000,
      filterKeepAliveMessages:
        globalConfig.sessionRecording?.filterKeepAliveMessages ?? true,
    });

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

      // Choose the correct client based on protocol
      const isHttps = url.startsWith('https:');
      const client = isHttps ? https : http;

      const req = client.get(
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
      H: SIGNALR_DEFAULTS.HUB_NAME,
      M: SIGNALR_DEFAULTS.SUBSCRIBE_METHOD,
      A: [this.currentStreamSet],
      I: SIGNALR_DEFAULTS.MESSAGE_ID,
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
      const timestamp = new Date().toISOString();

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
        timestamp,
      });

      // Parse with error boundary to prevent memory leaks from malformed JSON
      let payload: Record<string, unknown>;
      let parseError: string | undefined;

      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch (error) {
        parseError = (error as Error).message;
        logger.warn('Failed to parse SignalR message', {
          error: parseError,
          dataPreview: data.substring(
            0,
            SIGNALR_DEFAULTS.PARSE_ERROR_PREVIEW_SIZE
          ),
        });

        // Log unparseable message
        this.messageLogger.logMessage({
          timestamp,
          direction: 'incoming',
          messageType: 'PARSE_ERROR',
          dataLength: data.length,
          rawMessage: data,
          parseError,
          connectionState: this.getConnectionState() || undefined,
        });

        return;
      }

      // Determine message type
      let messageType = 'UNKNOWN';
      if (payload.M && Array.isArray(payload.M)) {
        messageType = 'HUB_MESSAGE';
      } else if (payload.R) {
        messageType = 'RESPONSE_MESSAGE';
      } else if (payload.C) {
        messageType = 'CONNECTION_MESSAGE';
      } else if (payload.S) {
        messageType = 'STATE_MESSAGE';
      } else if (payload.I) {
        messageType = 'IDENTIFIER_MESSAGE';
      }

      // Log message to file
      this.messageLogger.logMessage({
        timestamp,
        direction: 'incoming',
        messageType,
        dataLength: data.length,
        rawMessage: data,
        parsedMessage: payload,
        connectionState: this.getConnectionState() || undefined,
      });

      // Record message for session recording
      this.sessionRecorder.recordMessage(
        data,
        'incoming',
        messageType,
        payload,
        this.extractStreamNameFromPayload(payload, messageType)
      );

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

        // Auto-start session recording if enabled and SessionInfo is received
        const responseObj = payload.R as Record<string, unknown>;
        if (
          globalConfig.sessionRecording.autoStart &&
          responseObj.SessionInfo &&
          !this.sessionRecorder.isCurrentlyRecording()
        ) {
          const sessionInfo = responseObj.SessionInfo as Record<
            string,
            unknown
          >;
          this.sessionRecorder.startRecording({
            sessionType: sessionInfo.Type as string,
            sessionName: sessionInfo.Name as string,
            location: (sessionInfo.Meeting as Record<string, unknown>)
              ?.Location as string,
          });
        }

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

  /**
   * Set the F1 stream set to subscribe to
   * @param streamSet - Array of F1 stream names or predefined stream set
   */
  setStreamSet(
    streamSet: readonly string[] | keyof typeof F1_STREAM_SETS
  ): void {
    if (typeof streamSet === 'string') {
      this.currentStreamSet = F1_STREAM_SETS[streamSet];
    } else {
      this.currentStreamSet = streamSet;
    }

    logger.info('F1 stream set updated', {
      streamCount: this.currentStreamSet.length,
      streams: this.currentStreamSet,
    });
  }

  /**
   * Get the currently configured stream set
   */
  getCurrentStreamSet(): readonly string[] {
    return this.currentStreamSet;
  }

  /**
   * Get available predefined stream sets
   */
  getAvailableStreamSets(): typeof F1_STREAM_SETS {
    return F1_STREAM_SETS;
  }

  /**
   * Get all available F1 stream types
   */
  getAvailableStreams(): typeof F1Stream {
    return F1Stream;
  }

  /**
   * Start session recording manually
   */
  startSessionRecording(sessionInfo?: {
    sessionType?: string;
    sessionName?: string;
    location?: string;
  }): void {
    this.sessionRecorder.startRecording(sessionInfo);
  }

  /**
   * Stop session recording manually
   */
  stopSessionRecording(): SessionRecording | null {
    return this.sessionRecorder.stopRecording();
  }

  /**
   * Check if session recording is active
   */
  isRecordingSession(): boolean {
    return this.sessionRecorder.isCurrentlyRecording();
  }

  /**
   * Get current session recording metadata
   */
  getCurrentSessionMetadata(): SessionRecording['metadata'] | null {
    return this.sessionRecorder.getCurrentSessionMetadata();
  }

  /**
   * List available session recordings
   */
  listSessionRecordings(): string[] {
    return this.sessionRecorder.listRecordings();
  }

  /**
   * Load a session recording
   */
  loadSessionRecording(filename: string): SessionRecording | null {
    return this.sessionRecorder.loadRecording(filename);
  }

  private extractStreamNameFromPayload(
    payload: Record<string, unknown>,
    messageType: string
  ): string | undefined {
    // Extract stream name for hub messages
    if (
      messageType === 'HUB_MESSAGE' &&
      payload.M &&
      Array.isArray(payload.M)
    ) {
      for (const hubMsg of payload.M) {
        if (typeof hubMsg === 'object' && hubMsg !== null) {
          const msg = hubMsg as Record<string, unknown>;
          if (
            msg.M === 'feed' &&
            msg.A &&
            Array.isArray(msg.A) &&
            msg.A.length > 0
          ) {
            return msg.A[0] as string;
          }
        }
      }
    }

    // Extract stream name for response messages
    if (
      messageType === 'RESPONSE_MESSAGE' &&
      payload.R &&
      typeof payload.R === 'object'
    ) {
      const responseKeys = Object.keys(payload.R);
      if (responseKeys.length === 1) {
        return responseKeys[0];
      } else if (responseKeys.length > 1) {
        return responseKeys.join(',');
      }
    }

    return undefined;
  }
}

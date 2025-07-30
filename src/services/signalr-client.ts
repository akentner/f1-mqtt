import { EventEmitter } from 'events';
import WebSocket from 'ws';
import https from 'https';
import { SignalRConfig, F1Event } from '../types';
import { logger } from '../utils/logger';

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
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  // F1 Live Timing API endpoints
  private readonly NEGOTIATE_URL =
    'https://livetiming.formula1.com/signalr/negotiate';
  private readonly CONNECT_URL =
    'wss://livetiming.formula1.com/signalr/connect';
  private readonly HUB_DATA = '[{"name":"Streaming"}]';

  constructor(config: SignalRConfig) {
    super();
    this.config = config;
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
        setTimeout(() => this.connect(), delay);
      } else {
        this.emit('connectionFailed', error);
      }

      throw error;
    }
  }

  private async negotiate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        clientProtocol: '1.5',
        connectionData: this.HUB_DATA,
      });

      const url = `${this.NEGOTIATE_URL}?${params.toString()}`;

      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': 'BestHTTP',
            'Accept-Encoding': 'gzip,identity',
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

      req.setTimeout(10000, () => {
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
        transport: 'webSockets',
        clientProtocol: '1.5',
        connectionToken: this.connectionToken,
        connectionData: this.HUB_DATA,
      });

      const url = `${this.CONNECT_URL}?${params.toString()}`;

      const headers: Record<string, string> = {
        'User-Agent': 'BestHTTP',
        'Accept-Encoding': 'gzip,identity',
      };

      if (this.cookie) {
        headers['Cookie'] = this.cookie;
      }

      this.ws = new WebSocket(url, { headers });

      this.ws.on('open', () => {
        logger.debug('🔌 WebSocket connection established');
        logger.info('WebSocket connection opened', {
          url: url.substring(0, 100) + '...',
          readyState: this.ws?.readyState,
        });
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const rawMessage = data.toString();
        logger.debug('📥 Raw WebSocket Message Received', {
          messageLength: rawMessage.length,
          messagePreview: rawMessage.substring(0, 100),
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
      }, 10000);
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
          'TimingData',
          'CarData.z',
          'Position.z',
          'ExtrapolatedClock',
          'TopThree',
          'RcmSeries',
          'TimingStats',
          'TimingAppData',
          'WeatherData',
          'TrackStatus',
          'DriverList',
          'SessionInfo',
          'SessionData',
          'LapCount',
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
      // Log raw SignalR message
      logger.debug('📨 RAW SignalR Message', {
        rawData: data,
        dataLength: data.length,
        timestamp: new Date().toISOString(),
      });

      const payload = JSON.parse(data);

      // Log parsed payload structure
      logger.debug('📋 Parsed SignalR Payload', {
        payloadType: typeof payload,
        payloadKeys:
          typeof payload === 'object' ? Object.keys(payload) : payload,
        hasM: 'M' in payload,
        hasR: 'R' in payload,
        hasC: 'C' in payload,
        hasS: 'S' in payload,
        hasI: 'I' in payload,
        fullPayload: JSON.stringify(payload, null, 2),
      });

      // Handle hub messages (M property)
      if (payload.M) {
        logger.debug('🔄 Processing Hub Messages (M)', {
          messageCount: payload.M.length,
          messages: payload.M.map((msg: Record<string, unknown>) => ({
            method: msg.M,
            hasArgs: 'A' in msg,
            argCount: msg.A ? (msg.A as unknown[]).length : 0,
          })),
        });

        for (const hubMsg of payload.M) {
          if (hubMsg.M === 'feed') {
            this.processFeedMessage(hubMsg);
          }
        }
      }

      // Handle response messages (R property)
      if (payload.R) {
        logger.debug('📊 Processing Response Messages (R)', {
          responseKeys: Object.keys(payload.R),
          responseData: JSON.stringify(payload.R, null, 2),
        });
        this.processResponseMessage(payload.R);
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
        rawData: data.substring(0, 500),
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
        streamDataPreview: JSON.stringify(streamData).substring(0, 200),
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
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.isConnectedState = false;
      this.connectionToken = null;
      this.cookie = null;

      logger.info('Disconnected from F1 SignalR service');
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

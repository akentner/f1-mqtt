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

export class F1SignalRClient extends EventEmitter {
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
        logger.debug('WebSocket connection established');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
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
          'RaceControlMessages',
          'SessionInfo',
          'SessionData',
          'LapCount',
          'TimingData',
        ],
      ],
      I: 1,
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    logger.debug('Subscribed to F1 data streams');
  }

  private handleMessage(data: string): void {
    try {
      const payload = JSON.parse(data);
      logger.debug('Received SignalR message', { payload });

      // Handle hub messages (M property)
      if (payload.M) {
        for (const hubMsg of payload.M) {
          if (hubMsg.M === 'feed') {
            this.processFeedMessage(hubMsg);
          }
        }
      }

      // Handle response messages (R property)
      if (payload.R) {
        this.processResponseMessage(payload.R);
      }
    } catch (error) {
      logger.error('Failed to parse SignalR message', {
        error: (error as Error).message,
        data: data.substring(0, 200),
      });
    }
  }

  private processFeedMessage(hubMsg: Record<string, unknown>): void {
    const streamName = hubMsg.A?.[0] as string;
    const streamData = hubMsg.A?.[1] as Record<string, unknown>;

    if (!streamName || !streamData) {
      return;
    }

    const event: F1Event = {
      eventType: streamName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      timestamp: new Date().toISOString(),
      data: streamData,
    };

    logger.debug('Processing feed message', {
      streamName,
      eventType: event.eventType,
    });

    this.emit('event', event);
  }

  private processResponseMessage(response: Record<string, unknown>): void {
    for (const [streamName, streamData] of Object.entries(response)) {
      const event: F1Event = {
        eventType: streamName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        timestamp: new Date().toISOString(),
        data: streamData as Record<string, unknown>,
      };

      logger.debug('Processing response message', {
        streamName,
        eventType: event.eventType,
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

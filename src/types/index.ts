// Import F1 stream types from SignalR client
export { F1Stream, F1_STREAM_SETS } from '../services/signalr-client';

// Configuration interface definitions
export interface SignalRConfig {
  hubUrl: string;
  hubName: string;
  accessToken?: string;
  automaticReconnect?: boolean;
  reconnectDelays?: number[];
  // F1 Live Timing API endpoints
  negotiateUrl?: string;
  connectUrl?: string;
}

export interface MqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  topicPrefix?: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  protocolVersion?: 3 | 4 | 5;
  connectTimeout?: number;
  reconnectPeriod?: number;
  keepalive?: number;
  cleanSession?: boolean;
  sessionExpiryInterval?: number;
  birthTopic?: string;
  birthMessage?: string;
  willTopic?: string;
  willMessage?: string;
}

export interface AppConfig {
  signalR: SignalRConfig;
  mqtt: MqttConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableFile?: boolean;
    filePath?: string;
  };
  server: {
    port: number;
    healthCheckEndpoint: string;
  };
  homeAssistant?: {
    discoveryPrefix: string;
    nodeId: string;
  };
}

// Event data structures
export interface F1Event {
  eventType: string;
  timestamp: string;
  sessionKey?: string;
  driverNumber?: number;
  data: Record<string, unknown>;
}

export interface MqttMessage {
  topic: string;
  payload: string | Buffer;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

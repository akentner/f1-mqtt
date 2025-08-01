import { AppConfig } from '../types';

// Default configuration values
const DEFAULT_VALUES = {
  SIGNALR: {
    HUB_URL: 'https://livetiming.formula1.com/signalr',
    HUB_NAME: 'f1TimingHub',
    AUTOMATIC_RECONNECT: true,
    RECONNECT_DELAYS: [0, 2000, 10000, 30000] as number[],
    // F1 Live Timing API endpoints - configurable via environment
    NEGOTIATE_URL:
      process.env.F1_NEGOTIATE_URL ||
      'https://livetiming.formula1.com/signalr/negotiate',
    CONNECT_URL:
      process.env.F1_CONNECT_URL ||
      'wss://livetiming.formula1.com/signalr/connect',
  },
  MQTT: {
    BROKER_URL: 'mqtt://localhost:1883',
    TOPIC_PREFIX: 'f1',
    QOS: 1,
    RETAIN: false,
    PROTOCOL_VERSION: 4,
    CONNECT_TIMEOUT: 30000,
    RECONNECT_PERIOD: 10000,
    KEEPALIVE: 30,
    CLEAN_SESSION: true,
    SESSION_EXPIRY_INTERVAL: 3600,
    BIRTH_MESSAGE: 'online',
    WILL_MESSAGE: 'offline',
  },
  LOGGING: {
    LEVEL: 'info' as const,
    ENABLE_CONSOLE: true,
    ENABLE_FILE: false,
    FILE_PATH: './logs/app.log',
  },
  SIGNALR_MESSAGE_LOGGING: {
    ENABLED: false,
    FILE_PATH: './logs/signalr-messages.log',
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_FILES: 10,
  },
  SESSION_RECORDING: {
    ENABLED: false,
    RECORDING_PATH: './recordings',
    MAX_RECORDING_SIZE: 100 * 1024 * 1024, // 100MB
    AUTO_START: false,
    SESSION_DETECTION_TIMEOUT: 30000, // 30 seconds
    FILTER_KEEP_ALIVE_MESSAGES: true, // Filter out empty keep-alive messages
  },
  SERVER: {
    PORT: 3000,
    HEALTH_ENDPOINT: '/health',
  },
  HOME_ASSISTANT: {
    DISCOVERY_PREFIX: 'homeassistant',
    NODE_ID: 'f1_telemetry',
  },
} as const;

// Utility functions for configuration
const generateClientId = (prefix: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${randomId}`;
};

const buildTopicWithPrefix = (prefix: string, suffix: string): string => {
  return `${prefix}/${suffix}`;
};

// Helper functions for environment variable parsing
const parseIntWithDefault = (
  envValue: string | undefined,
  defaultValue: number
): number => {
  return envValue ? parseInt(envValue) : defaultValue;
};

const parseBooleanWithDefault = (
  envValue: string | undefined,
  defaultValue: boolean
): boolean => {
  if (envValue === undefined) return defaultValue;
  return envValue === 'true';
};

const config: AppConfig = {
  signalR: {
    hubUrl: process.env.SIGNALR_HUB_URL || DEFAULT_VALUES.SIGNALR.HUB_URL,
    hubName: process.env.SIGNALR_HUB_NAME || DEFAULT_VALUES.SIGNALR.HUB_NAME,
    ...(process.env.SIGNALR_ACCESS_TOKEN && {
      accessToken: process.env.SIGNALR_ACCESS_TOKEN,
    }),
    automaticReconnect: DEFAULT_VALUES.SIGNALR.AUTOMATIC_RECONNECT,
    reconnectDelays: DEFAULT_VALUES.SIGNALR.RECONNECT_DELAYS,
    // F1 Live Timing API endpoints - configurable for development
    negotiateUrl: DEFAULT_VALUES.SIGNALR.NEGOTIATE_URL,
    connectUrl: DEFAULT_VALUES.SIGNALR.CONNECT_URL,
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || DEFAULT_VALUES.MQTT.BROKER_URL,
    ...(process.env.MQTT_USERNAME && { username: process.env.MQTT_USERNAME }),
    ...(process.env.MQTT_PASSWORD && { password: process.env.MQTT_PASSWORD }),
    clientId: process.env.MQTT_CLIENT_ID
      ? generateClientId(process.env.MQTT_CLIENT_ID)
      : generateClientId('f1-mqtt-bridge'),
    topicPrefix:
      process.env.MQTT_TOPIC_PREFIX || DEFAULT_VALUES.MQTT.TOPIC_PREFIX,
    qos: parseIntWithDefault(process.env.MQTT_QOS, DEFAULT_VALUES.MQTT.QOS) as
      | 0
      | 1
      | 2,
    retain: parseBooleanWithDefault(
      process.env.MQTT_RETAIN,
      DEFAULT_VALUES.MQTT.RETAIN
    ),
    protocolVersion: parseIntWithDefault(
      process.env.MQTT_PROTOCOL_VERSION,
      DEFAULT_VALUES.MQTT.PROTOCOL_VERSION
    ) as 3 | 4 | 5,
    connectTimeout: parseIntWithDefault(
      process.env.MQTT_CONNECT_TIMEOUT,
      DEFAULT_VALUES.MQTT.CONNECT_TIMEOUT
    ),
    reconnectPeriod: parseIntWithDefault(
      process.env.MQTT_RECONNECT_PERIOD,
      DEFAULT_VALUES.MQTT.RECONNECT_PERIOD
    ),
    keepalive: parseIntWithDefault(
      process.env.MQTT_KEEPALIVE,
      DEFAULT_VALUES.MQTT.KEEPALIVE
    ),
    cleanSession: parseBooleanWithDefault(
      process.env.MQTT_CLEAN_SESSION,
      DEFAULT_VALUES.MQTT.CLEAN_SESSION
    ),
    sessionExpiryInterval: parseIntWithDefault(
      process.env.MQTT_SESSION_EXPIRY_INTERVAL,
      DEFAULT_VALUES.MQTT.SESSION_EXPIRY_INTERVAL
    ),
    birthTopic:
      process.env.MQTT_BIRTH_TOPIC ||
      buildTopicWithPrefix(
        process.env.MQTT_TOPIC_PREFIX || DEFAULT_VALUES.MQTT.TOPIC_PREFIX,
        'status'
      ),
    birthMessage:
      process.env.MQTT_BIRTH_MESSAGE || DEFAULT_VALUES.MQTT.BIRTH_MESSAGE,
    willTopic:
      process.env.MQTT_WILL_TOPIC ||
      buildTopicWithPrefix(
        process.env.MQTT_TOPIC_PREFIX || DEFAULT_VALUES.MQTT.TOPIC_PREFIX,
        'status'
      ),
    willMessage:
      process.env.MQTT_WILL_MESSAGE || DEFAULT_VALUES.MQTT.WILL_MESSAGE,
  },
  logging: {
    level:
      (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ||
      DEFAULT_VALUES.LOGGING.LEVEL,
    enableConsole: parseBooleanWithDefault(
      process.env.LOG_CONSOLE,
      DEFAULT_VALUES.LOGGING.ENABLE_CONSOLE
    ),
    enableFile: parseBooleanWithDefault(
      process.env.LOG_FILE,
      DEFAULT_VALUES.LOGGING.ENABLE_FILE
    ),
    filePath: process.env.LOG_FILE_PATH || DEFAULT_VALUES.LOGGING.FILE_PATH,
  },
  signalRMessageLogging: {
    enabled: parseBooleanWithDefault(
      process.env.SIGNALR_MESSAGE_LOGGING,
      DEFAULT_VALUES.SIGNALR_MESSAGE_LOGGING.ENABLED
    ),
    filePath:
      process.env.SIGNALR_LOG_FILE_PATH ||
      DEFAULT_VALUES.SIGNALR_MESSAGE_LOGGING.FILE_PATH,
    maxFileSize: parseIntWithDefault(
      process.env.SIGNALR_LOG_MAX_FILE_SIZE,
      DEFAULT_VALUES.SIGNALR_MESSAGE_LOGGING.MAX_FILE_SIZE
    ),
    maxFiles: parseIntWithDefault(
      process.env.SIGNALR_LOG_MAX_FILES,
      DEFAULT_VALUES.SIGNALR_MESSAGE_LOGGING.MAX_FILES
    ),
  },
  sessionRecording: {
    enabled: parseBooleanWithDefault(
      process.env.SESSION_RECORDING_ENABLED,
      DEFAULT_VALUES.SESSION_RECORDING.ENABLED
    ),
    recordingPath:
      process.env.SESSION_RECORDING_PATH ||
      DEFAULT_VALUES.SESSION_RECORDING.RECORDING_PATH,
    maxRecordingSize: parseIntWithDefault(
      process.env.SESSION_RECORDING_MAX_SIZE,
      DEFAULT_VALUES.SESSION_RECORDING.MAX_RECORDING_SIZE
    ),
    autoStart: parseBooleanWithDefault(
      process.env.SESSION_RECORDING_AUTO_START,
      DEFAULT_VALUES.SESSION_RECORDING.AUTO_START
    ),
    sessionDetectionTimeout: parseIntWithDefault(
      process.env.SESSION_DETECTION_TIMEOUT,
      DEFAULT_VALUES.SESSION_RECORDING.SESSION_DETECTION_TIMEOUT
    ),
    filterKeepAliveMessages: parseBooleanWithDefault(
      process.env.SESSION_RECORDING_FILTER_KEEP_ALIVE,
      DEFAULT_VALUES.SESSION_RECORDING.FILTER_KEEP_ALIVE_MESSAGES
    ),
  },
  server: {
    port: parseIntWithDefault(process.env.PORT, DEFAULT_VALUES.SERVER.PORT),
    healthCheckEndpoint:
      process.env.HEALTH_ENDPOINT || DEFAULT_VALUES.SERVER.HEALTH_ENDPOINT,
  },
  homeAssistant: {
    discoveryPrefix:
      process.env.HA_DISCOVERY_PREFIX ||
      DEFAULT_VALUES.HOME_ASSISTANT.DISCOVERY_PREFIX,
    nodeId: process.env.HA_NODE_ID || DEFAULT_VALUES.HOME_ASSISTANT.NODE_ID,
  },
};

// Export the main configuration
export default config;

// Export constants for external use (e.g., documentation, tests)
export { DEFAULT_VALUES };

// Export utility functions for configuration helpers
export {
  generateClientId,
  buildTopicWithPrefix,
  parseIntWithDefault,
  parseBooleanWithDefault,
};

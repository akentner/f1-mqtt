import { AppConfig } from '../types';

const config: AppConfig = {
  signalR: {
    hubUrl:
      process.env.SIGNALR_HUB_URL || 'https://livetiming.formula1.com/signalr',
    hubName: process.env.SIGNALR_HUB_NAME || 'f1TimingHub',
    ...(process.env.SIGNALR_ACCESS_TOKEN && {
      accessToken: process.env.SIGNALR_ACCESS_TOKEN,
    }),
    automaticReconnect: true,
    reconnectDelays: [0, 2000, 10000, 30000],
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    ...(process.env.MQTT_USERNAME && { username: process.env.MQTT_USERNAME }),
    ...(process.env.MQTT_PASSWORD && { password: process.env.MQTT_PASSWORD }),
    clientId: process.env.MQTT_CLIENT_ID
      ? `${process.env.MQTT_CLIENT_ID}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : `f1-mqtt-bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'f1',
    qos: parseInt(process.env.MQTT_QOS || '1') as 0 | 1 | 2,
    retain: process.env.MQTT_RETAIN === 'true',
    protocolVersion: parseInt(process.env.MQTT_PROTOCOL_VERSION || '4') as
      | 3
      | 4
      | 5,
    connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT || '30000'),
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '10000'),
    keepalive: parseInt(process.env.MQTT_KEEPALIVE || '30'),
    cleanSession: process.env.MQTT_CLEAN_SESSION !== 'false',
    sessionExpiryInterval: parseInt(
      process.env.MQTT_SESSION_EXPIRY_INTERVAL || '3600'
    ),
    birthTopic:
      process.env.MQTT_BIRTH_TOPIC ||
      `${process.env.MQTT_TOPIC_PREFIX || 'f1'}/status`,
    birthMessage: process.env.MQTT_BIRTH_MESSAGE || 'online',
    willTopic:
      process.env.MQTT_WILL_TOPIC ||
      `${process.env.MQTT_TOPIC_PREFIX || 'f1'}/status`,
    willMessage: process.env.MQTT_WILL_MESSAGE || 'offline',
  },
  logging: {
    level:
      (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    healthCheckEndpoint: process.env.HEALTH_ENDPOINT || '/health',
  },
  homeAssistant: {
    discoveryPrefix: process.env.HA_DISCOVERY_PREFIX || 'homeassistant',
    nodeId: process.env.HA_NODE_ID || 'f1_telemetry',
  },
};

export default config;

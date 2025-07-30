import { EventEmitter } from 'events';
import * as mqtt from 'mqtt';
import { MqttConfig, MqttMessage } from '../types';
import { logger } from '../utils/logger';

export class MqttPublisher extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private config: MqttConfig;
  private isConnected = false;
  private messageQueue: MqttMessage[] = [];
  private memoryCleanupTimer: NodeJS.Timeout | null = null;
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor(config: MqttConfig) {
    super();
    this.config = config;

    // Prevent memory leaks from EventEmitter
    this.setMaxListeners(15);

    // Start periodic memory cleanup
    this.startMemoryCleanup();
  }

  private startMemoryCleanup(): void {
    // Cleanup memory every 3 minutes for MQTT
    this.memoryCleanupTimer = setInterval(
      () => {
        this.performMemoryCleanup();
      },
      3 * 60 * 1000
    );
  }

  private performMemoryCleanup(): void {
    try {
      // Clear message queue if it gets too large
      if (this.messageQueue.length > this.MAX_QUEUE_SIZE) {
        const removedCount =
          this.messageQueue.length - Math.floor(this.MAX_QUEUE_SIZE * 0.8);
        this.messageQueue = this.messageQueue.slice(
          -Math.floor(this.MAX_QUEUE_SIZE * 0.8)
        );
        logger.debug('🧹 MQTT: Cleaned up message queue', {
          removedMessages: removedCount,
          newSize: this.messageQueue.length,
        });
      }

      // Log queue status
      logger.debug('📊 MQTT Queue Status', {
        queueSize: this.messageQueue.length,
        connected: this.isConnected,
        clientConnected: this.client?.connected || false,
      });
    } catch (error) {
      logger.warn('MQTT memory cleanup failed', {
        error: (error as Error).message,
      });
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info('Connecting to MQTT broker...', {
          brokerUrl: this.config.brokerUrl,
        });

        const options: mqtt.IClientOptions = {
          ...(this.config.clientId && { clientId: this.config.clientId }),
          clean: this.config.cleanSession ?? true,
          connectTimeout: this.config.connectTimeout || 30000,
          reconnectPeriod: this.config.reconnectPeriod || 10000,
          keepalive: this.config.keepalive || 30,
          protocolVersion: this.config.protocolVersion || 4,
          reschedulePings: true,
          // EMQX-spezifische Optimierungen
          resubscribe: false,
          queueQoSZero: false,
          properties:
            this.config.protocolVersion === 5
              ? {
                  sessionExpiryInterval:
                    this.config.sessionExpiryInterval || 3600,
                  receiveMaximum: 65535,
                  maximumPacketSize: 65535,
                  topicAliasMaximum: 0,
                  requestResponseInformation: false,
                  requestProblemInformation: false,
                }
              : undefined,
        };

        // Configure Last Will Testament
        const willTopic =
          this.config.willTopic || `${this.config.topicPrefix || 'f1'}/status`;
        if (willTopic) {
          options.will = {
            topic: willTopic,
            payload: this.config.willMessage || 'offline',
            qos: 1,
            retain: true,
          };
        }

        if (this.config.username && this.config.password) {
          options.username = this.config.username;
          options.password = this.config.password;
        }

        this.client = mqtt.connect(this.config.brokerUrl, options);

        this.client.on('connect', (connack) => {
          logger.info('Connected to MQTT broker (EMQX)', {
            clientId: this.config.clientId,
            sessionPresent: connack.sessionPresent,
            returnCode: connack.returnCode,
            protocolVersion: this.config.protocolVersion || 4,
            keepalive: this.config.keepalive || 30,
            cleanSession: this.config.cleanSession ?? true,
            properties: connack.properties || 'none',
          });
          this.isConnected = true;

          // Publish birth message
          this.publishBirthMessage();

          this.emit('connected');
          resolve();
        });

        this.client.on('error', (error) => {
          const errorDetails: Record<string, unknown> = {
            error: error.message,
          };

          if ('code' in error) {
            errorDetails.code = (error as unknown as { code: unknown }).code;
          }
          if ('errno' in error) {
            errorDetails.errno = (error as unknown as { errno: unknown }).errno;
          }

          logger.error('MQTT connection error', errorDetails);
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.client.on('offline', () => {
          logger.warn('MQTT client went offline', {
            brokerUrl: this.config.brokerUrl,
            clientId: this.config.clientId,
          });
          this.isConnected = false;
          this.emit('offline');
        });

        this.client.on('reconnect', () => {
          logger.info('MQTT client reconnecting...', {
            attempt: 'auto',
            brokerUrl: this.config.brokerUrl,
          });
          this.emit('reconnecting');
        });

        this.client.on('close', () => {
          logger.info('MQTT connection closed', {
            brokerUrl: this.config.brokerUrl,
            wasConnected: this.isConnected,
          });
          this.isConnected = false;
          this.emit('disconnected');
        });

        // Zusätzliche Debug-Events für EMQX
        this.client.on('packetsend', (packet) => {
          logger.debug('MQTT packet sent', {
            cmd: packet.cmd,
            messageId: packet.messageId,
          });
        });

        this.client.on('packetreceive', (packet) => {
          logger.debug('MQTT packet received', {
            cmd: packet.cmd,
            messageId: packet.messageId,
          });
        });

        // EMQX-spezifische Events
        this.client.on('end', () => {
          logger.warn('MQTT client ended', {
            brokerUrl: this.config.brokerUrl,
            clientId: this.config.clientId,
          });
          this.isConnected = false;
        });

        this.client.on('message', (topic, message) => {
          logger.debug('MQTT message received', {
            topic,
            size: message.length,
          });
        });
      } catch (error) {
        logger.error('Failed to create MQTT client', {
          error: (error as Error).message,
        });
        reject(error);
      }
    });
  }

  async publish(message: MqttMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        const error = new Error('MQTT client not connected');
        logger.error('Cannot publish message', { error: error.message });
        reject(error);
        return;
      }

      const qos = message.qos ?? this.config.qos ?? 1;
      const retain = message.retain ?? this.config.retain ?? false;

      this.client.publish(
        message.topic,
        message.payload,
        { qos, retain },
        (error) => {
          if (error) {
            logger.error('Failed to publish MQTT message', {
              error: error.message,
              topic: message.topic,
            });
            reject(error);
          } else {
            logger.debug('Published MQTT message', {
              topic: message.topic,
              qos,
              retain,
              payloadSize: Buffer.isBuffer(message.payload)
                ? message.payload.length
                : message.payload.length,
            });
            resolve();
          }
        }
      );
    });
  }

  async publishF1Event(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const topic = this.buildTopic(eventType);
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      eventType,
      data,
    });

    const message: MqttMessage = {
      topic,
      payload,
    };

    if (this.config.qos !== undefined) {
      message.qos = this.config.qos;
    }
    if (this.config.retain !== undefined) {
      message.retain = this.config.retain;
    }

    await this.publish(message);
  }

  async publishHomeAssistantDiscovery(
    deviceConfig: Record<string, unknown>
  ): Promise<void> {
    const topic = `${this.config.topicPrefix || 'f1'}/homeassistant/discovery`;
    const payload = JSON.stringify(deviceConfig);

    await this.publish({
      topic,
      payload,
      qos: 1,
      retain: true,
    });
  }

  private buildTopic(eventType: string): string {
    const prefix = this.config.topicPrefix || 'f1';
    return `${prefix}/${eventType.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Clear memory cleanup timer
        if (this.memoryCleanupTimer) {
          clearInterval(this.memoryCleanupTimer);
          this.memoryCleanupTimer = null;
        }

        // Clear message queue
        this.messageQueue = [];

        if (this.client && this.isConnected) {
          logger.info('Disconnecting from MQTT broker...');

          this.client.end(false, {}, () => {
            this.isConnected = false;
            this.client = null;

            // Remove all event listeners to prevent memory leaks
            this.removeAllListeners();

            logger.info(
              'Disconnected from MQTT broker and cleaned up resources'
            );
            resolve();
          });
        } else {
          this.isConnected = false;
          this.client = null;
          this.removeAllListeners();
          resolve();
        }
      } catch (error) {
        logger.error('Error disconnecting from MQTT broker', {
          error: (error as Error).message,
        });
        this.isConnected = false;
        this.client = null;
        resolve();
      }
    });
  }

  private publishBirthMessage(): void {
    if (!this.client || !this.isConnected) return;

    const birthTopic =
      this.config.birthTopic || `${this.config.topicPrefix || 'f1'}/status`;
    const birthMessage = this.config.birthMessage || 'online';

    this.client.publish(
      birthTopic,
      birthMessage,
      { qos: 1, retain: true },
      (error) => {
        if (error) {
          logger.error('Failed to publish birth message', {
            error: error.message,
            topic: birthTopic,
            message: birthMessage,
          });
        } else {
          logger.info('Published birth message', {
            topic: birthTopic,
            message: birthMessage,
          });
        }
      }
    );
  }

  private publishOnlineStatus(status: 'online' | 'offline'): void {
    if (!this.client || !this.isConnected) return;

    const topic = `${this.config.topicPrefix || 'f1'}/status`;
    this.client.publish(topic, status, { qos: 1, retain: true }, (error) => {
      if (error) {
        logger.error('Failed to publish online status', {
          error: error.message,
        });
      } else {
        logger.debug('Published online status', { status });
      }
    });
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

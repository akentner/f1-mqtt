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

          // Log retained topics configuration
          this.logRetainedTopicsConfig();

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

    // Determine if this topic should be retained
    const shouldRetain = this.shouldRetainTopic(topic);

    const message: MqttMessage = {
      topic,
      payload,
      retain: shouldRetain, // Use topic-specific retain logic
    };

    if (this.config.qos !== undefined) {
      message.qos = this.config.qos;
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

  /**
   * Check if a topic should be retained based on configured patterns
   */
  private shouldRetainTopic(topic: string): boolean {
    if (
      !this.config.retainedTopics ||
      this.config.retainedTopics.length === 0
    ) {
      return this.config.retain ?? false;
    }

    // Remove topic prefix for pattern matching
    const prefix = this.config.topicPrefix || 'f1';
    const topicWithoutPrefix = topic.startsWith(prefix + '/')
      ? topic.substring(prefix.length + 1)
      : topic;

    // Check each retained topic pattern
    for (const pattern of this.config.retainedTopics) {
      if (this.matchesMqttPattern(topicWithoutPrefix, pattern)) {
        logger.debug('Topic matched MQTT retain pattern', {
          topic: topicWithoutPrefix,
          pattern,
          retain: true,
        });
        return true;
      }
    }

    // Default to global retain setting if no pattern matches
    return this.config.retain ?? false;
  }

  /**
   * Check if a topic matches an MQTT pattern with standard wildcards
   * Supports MQTT standard wildcards:
   * - + matches any single topic level
   * - # matches any number of topic levels (must be last character)
   */
  private matchesMqttPattern(topic: string, pattern: string): boolean {
    // Handle exact match first
    if (pattern === topic) return true;

    // Validate # wildcard usage (must be last and alone in level)
    if (pattern.includes('#')) {
      if (
        !pattern.endsWith('#') ||
        (pattern !== '#' && !pattern.endsWith('/#'))
      ) {
        logger.warn('Invalid MQTT pattern: # must be last character', {
          pattern,
        });
        return false;
      }
    }

    // Split into topic levels
    const topicLevels = topic.split('/');
    const patternLevels = pattern.split('/');

    // Handle # wildcard (matches all remaining levels)
    if (pattern.endsWith('#')) {
      const patternWithoutHash =
        pattern === '#' ? [] : patternLevels.slice(0, -1);

      // Must have at least as many levels as pattern before #
      if (topicLevels.length < patternWithoutHash.length) {
        return false;
      }

      // Check levels before # wildcard
      for (let i = 0; i < patternWithoutHash.length; i++) {
        if (
          patternWithoutHash[i] !== '+' &&
          patternWithoutHash[i] !== topicLevels[i]
        ) {
          return false;
        }
      }

      return true;
    }

    // Without #, must have exact same number of levels
    if (topicLevels.length !== patternLevels.length) {
      return false;
    }

    // Check each level
    for (let i = 0; i < patternLevels.length; i++) {
      if (patternLevels[i] !== '+' && patternLevels[i] !== topicLevels[i]) {
        return false;
      }
    }

    return true;
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

  /**
   * Log the retained topics configuration at startup
   */
  private logRetainedTopicsConfig(): void {
    const retainedTopics = this.config.retainedTopics;
    const globalRetain = this.config.retain ?? false;
    const topicPrefix = this.config.topicPrefix || 'f1';

    if (!retainedTopics || retainedTopics.length === 0) {
      logger.info('📌 MQTT Retain Configuration', {
        mode: 'global',
        globalRetain,
        retainedPatterns: 'none',
        note: globalRetain
          ? 'All topics will be retained'
          : 'No topics will be retained',
      });
    } else {
      logger.info('📌 MQTT Retain Configuration', {
        mode: 'pattern-based',
        globalRetain,
        patternCount: retainedTopics.length,
        retainedPatterns: retainedTopics,
        topicPrefix,
        examples: retainedTopics
          .slice(0, 3)
          .map((pattern) => `${topicPrefix}/${pattern}`),
        note: `Topics matching these MQTT patterns will be retained (+ = single level, # = multi-level)`,
      });

      // Log some example matches for the first few patterns
      const exampleTopics = [
        'sessioninfo',
        'sessiondata',
        'driver1/status',
        'session/status',
        'weather/temperature',
        'weather/humidity/current',
        'homeassistant/discovery',
      ];

      const matchExamples: { pattern: string; matches: string[] }[] = [];
      retainedTopics.slice(0, 3).forEach((pattern) => {
        const matches = exampleTopics.filter((topic) =>
          this.matchesMqttPattern(topic, pattern)
        );
        if (matches.length > 0) {
          matchExamples.push({ pattern, matches: matches.slice(0, 3) });
        }
      });

      if (matchExamples.length > 0) {
        logger.info('📌 MQTT Pattern Examples', {
          examples: matchExamples.map(({ pattern, matches }) => ({
            pattern,
            sampleMatches: matches.map((match) => `${topicPrefix}/${match}`),
          })),
        });
      }
    }
  }
}

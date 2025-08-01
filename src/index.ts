// Load environment variables with .env.local support
import './config/env-loader';

import { SignalRClient } from './services/signalr-client';
import { MqttPublisher } from './services/mqtt-publisher';
import { EventProcessor } from './services/event-processor';
import { HealthServer } from './services/health-server';
import { logger } from './utils/logger';
import config from './config';

// Memory leak detection and monitoring
class MemoryMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMemoryUsage: NodeJS.MemoryUsage | null = null;

  start(): void {
    // Monitor memory every 60 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 60 * 1000);

    logger.info('🔍 Memory monitoring started');
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private checkMemoryUsage(): void {
    const currentMemory = process.memoryUsage();

    if (this.lastMemoryUsage) {
      const heapGrowth = currentMemory.heapUsed - this.lastMemoryUsage.heapUsed;
      const rssGrowth = currentMemory.rss - this.lastMemoryUsage.rss;

      // Log if significant memory increase (> 50MB)
      if (heapGrowth > 50 * 1024 * 1024 || rssGrowth > 50 * 1024 * 1024) {
        logger.warn('⚠️ Significant memory increase detected', {
          heapGrowth: `${Math.round(heapGrowth / 1024 / 1024)}MB`,
          rssGrowth: `${Math.round(rssGrowth / 1024 / 1024)}MB`,
          currentHeap: `${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`,
          currentRSS: `${Math.round(currentMemory.rss / 1024 / 1024)}MB`,
        });
      }
    }

    // Warn if memory usage is high
    if (currentMemory.heapUsed > 400 * 1024 * 1024) {
      // 400MB threshold
      logger.warn('🚨 High memory usage detected', {
        heapUsed: `${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(currentMemory.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(currentMemory.rss / 1024 / 1024)}MB`,
        external: `${Math.round(currentMemory.external / 1024 / 1024)}MB`,
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('🗑️ Forced garbage collection due to high memory usage');
      }
    }

    this.lastMemoryUsage = currentMemory;
  }
}

class F1MqttBridge {
  private signalRClient: SignalRClient;
  private mqttPublisher: MqttPublisher;
  private eventProcessor: EventProcessor;
  private healthServer: HealthServer;
  private memoryMonitor: MemoryMonitor;
  private isShuttingDown = false;

  constructor() {
    // Initialize memory monitoring
    this.memoryMonitor = new MemoryMonitor();
    // Initialize logger with configuration
    const loggerInstance = new (require('./utils/logger').Logger)(
      config.logging.level,
      config.logging.enableConsole,
      config.logging.enableFile,
      config.logging.filePath
    );

    // Replace global logger
    Object.assign(logger, loggerInstance);

    // Initialize services
    this.signalRClient = new SignalRClient(config.signalR);
    this.mqttPublisher = new MqttPublisher(config.mqtt);
    this.eventProcessor = new EventProcessor(
      this.signalRClient,
      this.mqttPublisher
    );
    this.healthServer = new HealthServer(
      this.eventProcessor,
      config.server.port,
      config.server.healthCheckEndpoint
    );

    this.setupEventHandlers();
    this.setupProcessHandlers();
  }

  private setupEventHandlers(): void {
    this.eventProcessor.on('started', () => {
      logger.info('Event processor started successfully');
    });

    this.eventProcessor.on('stopped', () => {
      logger.info('Event processor stopped');
    });

    this.eventProcessor.on('batch-processed', (eventCount: number) => {
      logger.debug('Event batch processed', { eventCount });
    });

    this.eventProcessor.on('batch-error', (error: Error, batch: any[]) => {
      logger.error('Event batch processing failed', {
        error: error.message,
        batchSize: batch.length,
      });
    });

    this.eventProcessor.on('event-published', (event: any) => {
      logger.debug('Event published to MQTT', { eventType: event.eventType });
    });

    this.eventProcessor.on('event-error', (error: Error, event: any) => {
      logger.error('Failed to publish event', {
        error: error.message,
        eventType: event.eventType,
      });
    });

    // Connection status logging
    this.eventProcessor.on('signalr-connected', () => {
      logger.info('SignalR connection established');
    });

    this.eventProcessor.on('signalr-disconnected', (error?: Error) => {
      if (error && !this.isShuttingDown) {
        logger.error('SignalR connection lost', { error: error.message });
      }
    });

    this.eventProcessor.on('mqtt-connected', () => {
      logger.info('MQTT connection established');
    });

    this.eventProcessor.on('mqtt-disconnected', () => {
      if (!this.isShuttingDown) {
        logger.warn('MQTT connection lost');
      }
    });
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown handling
    const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info('Received shutdown signal', { signal });
        await this.shutdown();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      this.shutdown().then(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: promise.toString(),
      });
      this.shutdown().then(() => process.exit(1));
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting F1 MQTT Bridge...', {
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development',
      });

      // Start memory monitoring
      this.memoryMonitor.start();

      // Start health server first
      await this.healthServer.start();
      logger.info('Health server started', {
        port: config.server.port,
        healthEndpoint: config.server.healthCheckEndpoint,
      });

      // Start event processor (which will connect SignalR and MQTT)
      await this.eventProcessor.start();

      // Publish Home Assistant discovery messages if configured
      if (config.homeAssistant) {
        await this.setupHomeAssistantDiscovery();
      }

      logger.info('F1 MQTT Bridge started successfully', {
        signalR: config.signalR.hubUrl,
        mqtt: config.mqtt.brokerUrl,
        topicPrefix: config.mqtt.topicPrefix,
      });
    } catch (error) {
      logger.error('Failed to start F1 MQTT Bridge', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async setupHomeAssistantDiscovery(): Promise<void> {
    try {
      logger.info('Setting up Home Assistant discovery...');

      const deviceConfig = {
        device: {
          identifiers: [`${config.homeAssistant?.nodeId}`],
          name: 'F1 Telemetry',
          model: 'F1 MQTT Bridge',
          manufacturer: 'Custom',
          sw_version: process.env.npm_package_version || '1.0.0',
        },
        availability: {
          topic: `${config.mqtt.topicPrefix}/status`,
          payload_available: 'online',
          payload_not_available: 'offline',
        },
        state_topic: `${config.mqtt.topicPrefix}/state`,
        json_attributes_topic: `${config.mqtt.topicPrefix}/attributes`,
        name: 'F1 Session Data',
        unique_id: `${config.homeAssistant?.nodeId}_session_data`,
      };

      await this.mqttPublisher.publishHomeAssistantDiscovery(deviceConfig);
      logger.info('Home Assistant discovery configuration published');
    } catch (error) {
      logger.error('Failed to setup Home Assistant discovery', {
        error: (error as Error).message,
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down F1 MQTT Bridge...');

    try {
      // Stop memory monitoring
      this.memoryMonitor.stop();

      // Publish offline status for Home Assistant
      if (config.homeAssistant) {
        await this.mqttPublisher.publish({
          topic: `${config.mqtt.topicPrefix}/status`,
          payload: 'offline',
          retain: true,
        });
      }

      // Stop services in reverse order
      await this.eventProcessor.stop();
      await this.healthServer.stop();

      logger.info('F1 MQTT Bridge shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown', {
        error: (error as Error).message,
      });
    }
  }

  getStatus(): any {
    return {
      application: 'F1 MQTT Bridge',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      processor: this.eventProcessor.getStatus(),
      config: {
        signalR: {
          hubUrl: config.signalR.hubUrl,
          hubName: config.signalR.hubName,
        },
        mqtt: {
          brokerUrl: config.mqtt.brokerUrl,
          topicPrefix: config.mqtt.topicPrefix,
        },
      },
    };
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  const bridge = new F1MqttBridge();

  bridge.start().catch((error) => {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  });
}

export default F1MqttBridge;

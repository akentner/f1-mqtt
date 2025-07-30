import { EventEmitter } from 'events';
import { SignalRClient } from './signalr-client';
import { MqttPublisher } from './mqtt-publisher';
import { F1Event } from '../types';
import { logger } from '../utils/logger';

export class EventProcessor extends EventEmitter {
  private signalRClient: SignalRClient;
  private mqttPublisher: MqttPublisher;
  private eventQueue: F1Event[] = [];
  private processing = false;
  private batchSize = 10;
  private batchTimeout = 1000; // ms
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(signalRClient: SignalRClient, mqttPublisher: MqttPublisher) {
    super();
    this.signalRClient = signalRClient;
    this.mqttPublisher = mqttPublisher;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.signalRClient.on('event', (event: F1Event) => {
      this.queueEvent(event);
    });

    this.signalRClient.on('connected', () => {
      logger.info('SignalR client connected, ready to process events');
      this.emit('signalr-connected');
    });

    this.signalRClient.on('disconnected', (error?: Error) => {
      logger.warn('SignalR client disconnected', { error: error?.message });
      this.emit('signalr-disconnected', error);
    });

    this.mqttPublisher.on('connected', () => {
      logger.info('MQTT publisher connected, ready to publish events');
      this.emit('mqtt-connected');
    });

    this.mqttPublisher.on('disconnected', () => {
      logger.warn('MQTT publisher disconnected');
      this.emit('mqtt-disconnected');
    });
  }

  private queueEvent(event: F1Event): void {
    // Enrich event with additional metadata
    const enrichedEvent: F1Event = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    this.eventQueue.push(enrichedEvent);
    logger.debug('Event queued', { 
      eventType: event.eventType, 
      queueSize: this.eventQueue.length 
    });

    this.scheduleProcessing();
  }

  private scheduleProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process immediately if batch size reached
    if (this.eventQueue.length >= this.batchSize) {
      this.processBatch();
    } else {
      // Schedule processing after timeout
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchTimeout);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = this.eventQueue.splice(0, this.batchSize);
    logger.debug('Processing event batch', { batchSize: batch.length });

    try {
      await this.processEvents(batch);
      logger.debug('Batch processed successfully', { eventCount: batch.length });
      this.emit('batch-processed', batch.length);
    } catch (error) {
      logger.error('Error processing batch', { 
        error: (error as Error).message,
        batchSize: batch.length 
      });
      this.emit('batch-error', error, batch);
      
      // Re-queue failed events (optional - could implement retry logic here)
      // this.eventQueue.unshift(...batch);
    } finally {
      this.processing = false;

      // Process next batch if queue is not empty
      if (this.eventQueue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private async processEvents(events: F1Event[]): Promise<void> {
    const publishPromises = events.map(async (event) => {
      try {
        const processedEvent = this.transformEvent(event);
        await this.mqttPublisher.publishF1Event(
          processedEvent.eventType,
          processedEvent.data
        );
        
        logger.debug('Event published', { eventType: event.eventType });
        this.emit('event-published', event);
      } catch (error) {
        logger.error('Failed to publish event', { 
          eventType: event.eventType,
          error: (error as Error).message 
        });
        this.emit('event-error', error, event);
        throw error; // Re-throw to trigger batch error handling
      }
    });

    await Promise.all(publishPromises);
  }

  private transformEvent(event: F1Event): F1Event {
    // Apply any event transformations here
    // Examples: filtering, data enrichment, format conversion
    
    const transformed: F1Event = {
      ...event,
      // Add processing timestamp
      data: {
        ...event.data,
        processedAt: new Date().toISOString(),
        // Add metadata for Home Assistant integration
        homeAssistant: {
          deviceClass: this.getDeviceClass(event.eventType),
          unitOfMeasurement: this.getUnitOfMeasurement(event.eventType),
        },
      },
    };

    return transformed;
  }

  private getDeviceClass(eventType: string): string {
    // Map F1 event types to Home Assistant device classes
    switch (eventType) {
      case 'timing':
        return 'timestamp';
      case 'car_data':
        return 'measurement';
      case 'session_info':
        return 'enum';
      default:
        return 'measurement';
    }
  }

  private getUnitOfMeasurement(eventType: string): string | undefined {
    // Map F1 event types to appropriate units
    switch (eventType) {
      case 'car_data':
        return 'km/h'; // Speed, could be more specific based on data
      case 'timing':
        return 's'; // Seconds
      default:
        return undefined;
    }
  }

  async start(): Promise<void> {
    logger.info('Starting event processor...');
    
    try {
      await this.mqttPublisher.connect();
      await this.signalRClient.connect();
      
      logger.info('Event processor started successfully');
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start event processor', { error: (error as Error).message });
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping event processor...');
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Process remaining events
    if (this.eventQueue.length > 0) {
      logger.info('Processing remaining events before shutdown', { 
        remainingEvents: this.eventQueue.length 
      });
      await this.processBatch();
    }

    await this.signalRClient.disconnect();
    await this.mqttPublisher.disconnect();
    
    logger.info('Event processor stopped');
    this.emit('stopped');
  }

  getStatus(): {
    queueSize: number;
    processing: boolean;
    signalRConnected: boolean;
    mqttConnected: boolean;
  } {
    return {
      queueSize: this.eventQueue.length,
      processing: this.processing,
      signalRConnected: this.signalRClient.isConnected(),
      mqttConnected: this.mqttPublisher.getConnectionStatus(),
    };
  }
}

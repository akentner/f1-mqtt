import express, { Request, Response } from 'express';
import { Server } from 'http';
import { EventProcessor } from './event-processor';
import { logger } from '../utils/logger';

export class HealthServer {
  private app: express.Application;
  private server: Server | null = null;
  private eventProcessor: EventProcessor;
  private port: number;
  private healthEndpoint: string;

  constructor(
    eventProcessor: EventProcessor,
    port = 3000,
    healthEndpoint = '/health'
  ) {
    this.eventProcessor = eventProcessor;
    this.port = port;
    this.healthEndpoint = healthEndpoint;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get(this.healthEndpoint, (req: Request, res: Response) => {
      const status = this.eventProcessor.getStatus();
      const isHealthy = status.signalRConnected && status.mqttConnected;
      const memUsage = process.memoryUsage();

      // Check for potential memory issues
      const memoryWarning = memUsage.heapUsed > 512 * 1024 * 1024; // 512MB threshold
      const finalStatus = isHealthy && !memoryWarning;

      res.status(finalStatus ? 200 : 503).json({
        status: finalStatus ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          signalR: status.signalRConnected ? 'connected' : 'disconnected',
          mqtt: status.mqttConnected ? 'connected' : 'disconnected',
        },
        queue: {
          size: status.queueSize,
          processing: status.processing,
        },
        uptime: process.uptime(),
        memory: {
          ...memUsage,
          warningThreshold: memoryWarning,
          usage: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
          },
        },
      });
    });

    // Status endpoint with more detailed information
    this.app.get('/status', (req: Request, res: Response) => {
      const status = this.eventProcessor.getStatus();

      res.json({
        application: 'F1 MQTT Bridge',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        services: {
          signalR: {
            connected: status.signalRConnected,
            status: status.signalRConnected ? 'connected' : 'disconnected',
          },
          mqtt: {
            connected: status.mqttConnected,
            status: status.mqttConnected ? 'connected' : 'disconnected',
          },
        },
        eventProcessor: {
          queueSize: status.queueSize,
          processing: status.processing,
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
        },
      });
    });

    // Metrics endpoint (for monitoring systems)
    this.app.get('/metrics', (req: Request, res: Response) => {
      const status = this.eventProcessor.getStatus();
      const memUsage = process.memoryUsage();

      // Calculate memory usage percentages and warnings
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      const memoryWarning = memUsage.heapUsed > 512 * 1024 * 1024 ? 1 : 0;

      // Prometheus-style metrics
      const metrics = [
        `# HELP f1_mqtt_queue_size Current size of the event queue`,
        `# TYPE f1_mqtt_queue_size gauge`,
        `f1_mqtt_queue_size ${status.queueSize}`,
        '',
        `# HELP f1_mqtt_signalr_connected SignalR connection status (1=connected, 0=disconnected)`,
        `# TYPE f1_mqtt_signalr_connected gauge`,
        `f1_mqtt_signalr_connected ${status.signalRConnected ? 1 : 0}`,
        '',
        `# HELP f1_mqtt_mqtt_connected MQTT connection status (1=connected, 0=disconnected)`,
        `# TYPE f1_mqtt_mqtt_connected gauge`,
        `f1_mqtt_mqtt_connected ${status.mqttConnected ? 1 : 0}`,
        '',
        `# HELP f1_mqtt_memory_usage_bytes Memory usage in bytes`,
        `# TYPE f1_mqtt_memory_usage_bytes gauge`,
        `f1_mqtt_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
        `f1_mqtt_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}`,
        `f1_mqtt_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}`,
        `f1_mqtt_memory_usage_bytes{type="external"} ${memUsage.external}`,
        '',
        `# HELP f1_mqtt_memory_heap_usage_percent Heap usage percentage`,
        `# TYPE f1_mqtt_memory_heap_usage_percent gauge`,
        `f1_mqtt_memory_heap_usage_percent ${heapUsagePercent.toFixed(2)}`,
        '',
        `# HELP f1_mqtt_memory_warning Memory warning indicator (1=warning, 0=ok)`,
        `# TYPE f1_mqtt_memory_warning gauge`,
        `f1_mqtt_memory_warning ${memoryWarning}`,
        '',
        `# HELP f1_mqtt_uptime_seconds Application uptime in seconds`,
        `# TYPE f1_mqtt_uptime_seconds counter`,
        `f1_mqtt_uptime_seconds ${process.uptime()}`,
      ].join('\n');

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    });

    // Memory debugging endpoint (only in debug mode)
    this.app.get('/debug/memory', (req: Request, res: Response) => {
      if (process.env.LOG_LEVEL !== 'debug') {
        res
          .status(403)
          .json({ error: 'Debug endpoint only available in debug mode' });
        return;
      }

      const memUsage = process.memoryUsage();

      // Force garbage collection if available and requested
      if (req.query.gc === 'true' && global.gc) {
        global.gc();
        logger.info('Manual garbage collection triggered via API');
      }

      const memAfterGC = process.memoryUsage();

      res.json({
        timestamp: new Date().toISOString(),
        memoryBefore: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        },
        memoryAfter: {
          rss: `${Math.round(memAfterGC.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memAfterGC.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memAfterGC.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memAfterGC.external / 1024 / 1024)}MB`,
        },
        gcAvailable: !!global.gc,
        gcTriggered: req.query.gc === 'true' && !!global.gc,
        uptime: process.uptime(),
        heapUsagePercent:
          ((memAfterGC.heapUsed / memAfterGC.heapTotal) * 100).toFixed(2) + '%',
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'F1 MQTT Bridge',
        description: 'Bridges F1 timing data from SignalR to MQTT',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
          health: this.healthEndpoint,
          status: '/status',
          metrics: '/metrics',
        },
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested endpoint ${req.originalUrl} was not found.`,
        availableEndpoints: ['/', this.healthEndpoint, '/status', '/metrics'],
      });
    });

    // Error handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.app.use((error: Error, req: Request, res: Response) => {
      logger.error('Express error handler', {
        error: error.message,
        url: req.url,
        method: req.method,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info('Health server started', {
            port: this.port,
            healthEndpoint: this.healthEndpoint,
          });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Health server error', {
            error: error.message,
            port: this.port,
          });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

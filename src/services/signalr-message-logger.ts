import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface SignalRMessageLog {
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  messageType: string;
  dataLength: number;
  rawMessage: string;
  parsedMessage?: Record<string, unknown> | undefined;
  parseError?: string | undefined;
  connectionState?: string | undefined;
}

export class SignalRMessageLogger {
  private logFilePath: string;
  private isEnabled: boolean;
  private maxFileSize: number;
  private maxFiles: number;
  private writeStream: fs.WriteStream | null = null;
  private messageCount = 0;
  private totalBytesLogged = 0;
  private startTime = new Date();

  constructor(
    options: {
      logFilePath?: string;
      enabled?: boolean;
      maxFileSize?: number;
      maxFiles?: number;
    } = {}
  ) {
    this.logFilePath = options.logFilePath || this.getDefaultLogPath();
    this.isEnabled =
      options.enabled ?? process.env.SIGNALR_MESSAGE_LOGGING === 'true';
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB
    this.maxFiles = options.maxFiles || 10;

    if (this.isEnabled) {
      this.initializeLogging();
    }
  }

  private getDefaultLogPath(): string {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(logsDir, `signalr-messages-${timestamp}.log`);
  }

  private initializeLogging(): void {
    try {
      // Ensure logs directory exists
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Clean up old log files
      this.cleanupOldLogs();

      // Create write stream
      this.writeStream = fs.createWriteStream(this.logFilePath, {
        flags: 'a',
        encoding: 'utf8',
      });

      this.writeStream.on('error', (error) => {
        logger.error('SignalR message log write error', {
          error: error.message,
          logFilePath: this.logFilePath,
        });
      });

      // Write header
      this.writeLogHeader();

      logger.info('SignalR message logging initialized', {
        logFilePath: this.logFilePath,
        maxFileSize: `${Math.round(this.maxFileSize / 1024 / 1024)}MB`,
        maxFiles: this.maxFiles,
      });
    } catch (error) {
      logger.error('Failed to initialize SignalR message logging', {
        error: (error as Error).message,
        logFilePath: this.logFilePath,
      });
      this.isEnabled = false;
    }
  }

  private writeLogHeader(): void {
    if (!this.writeStream) return;

    const header = [
      '================================================================================',
      `F1 MQTT Bridge - SignalR Message Log`,
      `Started: ${new Date().toISOString()}`,
      `Log File: ${this.logFilePath}`,
      `Process ID: ${process.pid}`,
      `Node.js Version: ${process.version}`,
      `Environment: ${process.env.NODE_ENV || 'unknown'}`,
      '================================================================================',
      '',
    ].join('\n');

    this.writeStream.write(header);
  }

  private cleanupOldLogs(): void {
    try {
      const logDir = path.dirname(this.logFilePath);
      const files = fs
        .readdirSync(logDir)
        .filter(
          (file) =>
            file.startsWith('signalr-messages-') && file.endsWith('.log')
        )
        .map((file) => ({
          name: file,
          path: path.join(logDir, file),
          stat: fs.statSync(path.join(logDir, file)),
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Keep only the most recent files
      const filesToDelete = files.slice(this.maxFiles - 1);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        logger.debug('Cleaned up old SignalR message log', {
          deletedFile: file.name,
          age: `${Math.round((Date.now() - file.stat.mtime.getTime()) / 1000 / 60)} minutes`,
        });
      }
    } catch (error) {
      logger.warn('Failed to cleanup old SignalR message logs', {
        error: (error as Error).message,
      });
    }
  }

  private checkFileRotation(): void {
    if (!this.writeStream || !fs.existsSync(this.logFilePath)) return;

    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > this.maxFileSize) {
        logger.info('Rotating SignalR message log file', {
          currentSize: `${Math.round(stats.size / 1024 / 1024)}MB`,
          maxSize: `${Math.round(this.maxFileSize / 1024 / 1024)}MB`,
        });

        this.writeStream.end();
        this.logFilePath = this.getDefaultLogPath();
        this.initializeLogging();
      }
    } catch (error) {
      logger.warn('Failed to check SignalR message log rotation', {
        error: (error as Error).message,
      });
    }
  }

  logMessage(messageLog: SignalRMessageLog): void {
    if (!this.isEnabled || !this.writeStream) return;

    try {
      this.messageCount++;
      this.totalBytesLogged += messageLog.dataLength;

      // Check for log rotation
      if (this.messageCount % 100 === 0) {
        this.checkFileRotation();
      }

      // Format log entry
      const logEntry = this.formatLogEntry(messageLog);
      this.writeStream.write(logEntry + '\n');

      // Log statistics periodically
      if (this.messageCount % 1000 === 0) {
        this.logStatistics();
      }
    } catch (error) {
      logger.error('Failed to write SignalR message log', {
        error: (error as Error).message,
        messageType: messageLog.messageType,
      });
    }
  }

  private formatLogEntry(messageLog: SignalRMessageLog): string {
    const lines = [
      `[${messageLog.timestamp}] ${messageLog.direction.toUpperCase()} - ${messageLog.messageType}`,
      `Length: ${messageLog.dataLength} bytes`,
    ];

    if (messageLog.connectionState) {
      lines.push(`Connection: ${messageLog.connectionState}`);
    }

    if (messageLog.parseError) {
      lines.push(`Parse Error: ${messageLog.parseError}`);
    }

    lines.push('Raw Message:');
    lines.push(messageLog.rawMessage);

    if (messageLog.parsedMessage) {
      lines.push('Parsed Message:');
      lines.push(JSON.stringify(messageLog.parsedMessage, null, 2));
    }

    lines.push('---');

    return lines.join('\n');
  }

  private logStatistics(): void {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    const avgMessagesPerSecond = Math.round(this.messageCount / uptime);
    const avgBytesPerSecond = Math.round(this.totalBytesLogged / uptime);

    logger.info('SignalR message logging statistics', {
      messageCount: this.messageCount,
      totalBytes: this.totalBytesLogged,
      uptime: `${uptime}s`,
      avgMessagesPerSecond,
      avgBytesPerSecond,
      logFile: this.logFilePath,
    });
  }

  getStatistics(): {
    messageCount: number;
    totalBytesLogged: number;
    uptimeSeconds: number;
    logFilePath: string;
    isEnabled: boolean;
  } {
    const uptimeSeconds = Math.round(
      (Date.now() - this.startTime.getTime()) / 1000
    );

    return {
      messageCount: this.messageCount,
      totalBytesLogged: this.totalBytesLogged,
      uptimeSeconds,
      logFilePath: this.logFilePath,
      isEnabled: this.isEnabled,
    };
  }

  close(): void {
    if (this.writeStream) {
      // Write final statistics
      const stats = this.getStatistics();
      const finalEntry = [
        '',
        '================================================================================',
        `Session ended: ${new Date().toISOString()}`,
        `Total messages logged: ${stats.messageCount}`,
        `Total bytes logged: ${stats.totalBytesLogged}`,
        `Session duration: ${stats.uptimeSeconds} seconds`,
        `Average messages/second: ${Math.round(stats.messageCount / stats.uptimeSeconds)}`,
        '================================================================================',
      ].join('\n');

      this.writeStream.write(finalEntry);
      this.writeStream.end();
      this.writeStream = null;

      logger.info('SignalR message logging closed', stats);
    }
  }

  enable(): void {
    if (!this.isEnabled) {
      this.isEnabled = true;
      this.initializeLogging();
      logger.info('SignalR message logging enabled');
    }
  }

  disable(): void {
    if (this.isEnabled) {
      this.isEnabled = false;
      this.close();
      logger.info('SignalR message logging disabled');
    }
  }
}

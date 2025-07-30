import { EventEmitter } from 'events';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger extends EventEmitter {
  private level: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private filePath?: string | undefined;

  constructor(
    level: 'debug' | 'info' | 'warn' | 'error' = 'info',
    enableConsole = true,
    enableFile = false,
    filePath?: string
  ) {
    super();
    this.level = this.parseLevel(level);
    this.enableConsole = enableConsole;
    this.enableFile = enableFile;
    this.filePath = filePath;
  }

  private parseLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, meta);

    if (this.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }

    // File logging would be implemented here
    if (this.enableFile && this.filePath) {
      // TODO: Implement file logging with fs.appendFile
    }

    this.emit('log', { level: levelName, message, meta, timestamp: new Date() });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, 'debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, 'info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, 'warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, 'error', message, meta);
  }
}

export const logger = new Logger();

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface SessionRecording {
  metadata: {
    sessionId: string;
    sessionType: string; // 'Practice', 'Qualifying', 'Race', etc.
    sessionName: string;
    location: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    recordingVersion: string;
    messageCount: number;
    totalSize: number;
  };
  messages: SessionMessage[];
}

export interface SessionMessage {
  timestamp: string;
  relativeTime: number; // milliseconds from session start
  messageType: string;
  direction: 'incoming' | 'outgoing';
  rawMessage: string;
  parsedMessage?: Record<string, unknown> | undefined;
  streamName?: string | undefined;
  dataSize: number;
}

export interface SessionRecorderConfig {
  enabled: boolean;
  recordingPath: string;
  maxRecordingSize: number; // in bytes
  autoStart: boolean;
  sessionDetectionTimeout: number; // ms to wait for session info
  filterKeepAliveMessages: boolean; // filter out empty keep-alive messages
}

export class SessionRecorder {
  private config: SessionRecorderConfig;
  private isRecording = false;
  private currentSession: SessionRecording | null = null;
  private sessionStartTime: Date | null = null;
  private recordingFilePath: string | null = null;
  private messageBuffer: SessionMessage[] = [];
  private totalRecordedSize = 0;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: SessionRecorderConfig) {
    this.config = config;

    if (this.config.enabled) {
      logger.info('Session recorder initialized', {
        recordingPath: this.config.recordingPath,
        maxSize: `${Math.round(this.config.maxRecordingSize / 1024 / 1024)}MB`,
        autoStart: this.config.autoStart,
      });
    }
  }

  /**
   * Start recording a new session
   */
  startRecording(sessionInfo?: {
    sessionType?: string;
    sessionName?: string;
    location?: string;
  }): void {
    if (!this.config.enabled) {
      logger.warn('Session recording is disabled');
      return;
    }

    if (this.isRecording) {
      logger.warn('Already recording a session, stopping current recording');
      this.stopRecording();
    }

    this.sessionStartTime = new Date();
    const sessionId = this.generateSessionId();

    this.currentSession = {
      metadata: {
        sessionId,
        sessionType: sessionInfo?.sessionType || 'Unknown',
        sessionName: sessionInfo?.sessionName || `Session_${sessionId}`,
        location: sessionInfo?.location || 'Unknown',
        startTime: this.sessionStartTime.toISOString(),
        recordingVersion: '1.0',
        messageCount: 0,
        totalSize: 0,
      },
      messages: [],
    };

    this.messageBuffer = [];
    this.totalRecordedSize = 0;
    this.isRecording = true;

    // Create recording file path
    const timestamp = this.sessionStartTime.toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${sessionInfo?.sessionType || 'session'}_${sessionId}.json`;
    this.recordingFilePath = path.join(this.config.recordingPath, filename);

    // Ensure recording directory exists
    this.ensureRecordingDirectory();

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds

    logger.info('Started session recording', {
      sessionId,
      sessionType: this.currentSession.metadata.sessionType,
      recordingFile: this.recordingFilePath,
    });
  }

  /**
   * Stop the current recording
   */
  stopRecording(): SessionRecording | null {
    if (!this.isRecording || !this.currentSession) {
      logger.warn('No active recording to stop');
      return null;
    }

    // Final flush
    this.flushBuffer();

    // Update metadata
    const endTime = new Date();
    this.currentSession.metadata.endTime = endTime.toISOString();
    this.currentSession.metadata.duration = this.sessionStartTime
      ? endTime.getTime() - this.sessionStartTime.getTime()
      : 0;
    this.currentSession.metadata.messageCount =
      this.currentSession.messages.length;
    this.currentSession.metadata.totalSize = this.totalRecordedSize;

    // Save final recording
    this.saveRecording();

    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    const completedSession = this.currentSession;

    logger.info('Session recording completed', {
      sessionId: completedSession.metadata.sessionId,
      duration: `${Math.round((completedSession.metadata.duration || 0) / 1000)}s`,
      messageCount: completedSession.metadata.messageCount,
      totalSize: `${Math.round(completedSession.metadata.totalSize / 1024)}KB`,
      recordingFile: this.recordingFilePath,
    });

    // Reset state
    this.currentSession = null;
    this.sessionStartTime = null;
    this.recordingFilePath = null;
    this.isRecording = false;
    this.messageBuffer = [];
    this.totalRecordedSize = 0;

    return completedSession;
  }

  /**
   * Record a SignalR message
   */
  recordMessage(
    rawMessage: string,
    direction: 'incoming' | 'outgoing',
    messageType: string,
    parsedMessage?: Record<string, unknown>,
    streamName?: string
  ): void {
    if (!this.isRecording || !this.currentSession || !this.sessionStartTime) {
      return;
    }

    // Filter out keep-alive messages if enabled
    if (
      this.config.filterKeepAliveMessages &&
      this.isKeepAliveMessage(rawMessage, messageType)
    ) {
      return;
    }

    // Check size limit
    if (this.totalRecordedSize > this.config.maxRecordingSize) {
      logger.warn('Recording size limit reached, stopping recording', {
        maxSize: `${Math.round(this.config.maxRecordingSize / 1024 / 1024)}MB`,
        currentSize: `${Math.round(this.totalRecordedSize / 1024 / 1024)}MB`,
      });
      this.stopRecording();
      return;
    }

    const now = new Date();
    const relativeTime = now.getTime() - this.sessionStartTime.getTime();
    const dataSize = Buffer.byteLength(rawMessage, 'utf8');

    const sessionMessage: SessionMessage = {
      timestamp: now.toISOString(),
      relativeTime,
      messageType,
      direction,
      rawMessage,
      parsedMessage,
      streamName,
      dataSize,
    };

    // Add to buffer
    this.messageBuffer.push(sessionMessage);
    this.totalRecordedSize += dataSize;

    // Auto-detect session info from SessionInfo messages
    if (messageType === 'RESPONSE_MESSAGE' && parsedMessage?.SessionInfo) {
      this.updateSessionMetadata(
        parsedMessage.SessionInfo as Record<string, unknown>
      );
    }

    logger.debug('Message recorded', {
      messageType,
      direction,
      streamName,
      relativeTime: `${relativeTime}ms`,
      dataSize: `${dataSize}B`,
      bufferSize: this.messageBuffer.length,
    });
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current session metadata
   */
  getCurrentSessionMetadata(): SessionRecording['metadata'] | null {
    return this.currentSession?.metadata || null;
  }

  /**
   * List available recordings
   */
  listRecordings(): string[] {
    try {
      if (!fs.existsSync(this.config.recordingPath)) {
        return [];
      }

      return fs
        .readdirSync(this.config.recordingPath)
        .filter((file) => file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Newest first
    } catch (error) {
      logger.error('Failed to list recordings', {
        error: (error as Error).message,
        recordingPath: this.config.recordingPath,
      });
      return [];
    }
  }

  /**
   * Load a recording by filename
   */
  loadRecording(filename: string): SessionRecording | null {
    try {
      const filePath = path.join(this.config.recordingPath, filename);

      if (!fs.existsSync(filePath)) {
        logger.error('Recording file not found', { filename, filePath });
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const recording = JSON.parse(data) as SessionRecording;

      logger.info('Recording loaded', {
        filename,
        sessionId: recording.metadata.sessionId,
        messageCount: recording.metadata.messageCount,
        duration: `${Math.round((recording.metadata.duration || 0) / 1000)}s`,
      });

      return recording;
    } catch (error) {
      logger.error('Failed to load recording', {
        error: (error as Error).message,
        filename,
      });
      return null;
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private updateSessionMetadata(sessionInfo: Record<string, unknown>): void {
    if (!this.currentSession) return;

    const meeting = sessionInfo.Meeting as Record<string, unknown>;
    if (meeting) {
      this.currentSession.metadata.location =
        (meeting.Location as string) || this.currentSession.metadata.location;
    }

    this.currentSession.metadata.sessionType =
      (sessionInfo.Type as string) || this.currentSession.metadata.sessionType;
    this.currentSession.metadata.sessionName =
      (sessionInfo.Name as string) || this.currentSession.metadata.sessionName;

    logger.debug('Updated session metadata from SessionInfo', {
      sessionType: this.currentSession.metadata.sessionType,
      sessionName: this.currentSession.metadata.sessionName,
      location: this.currentSession.metadata.location,
    });
  }

  private ensureRecordingDirectory(): void {
    try {
      if (!fs.existsSync(this.config.recordingPath)) {
        fs.mkdirSync(this.config.recordingPath, { recursive: true });
        logger.info('Created recording directory', {
          path: this.config.recordingPath,
        });
      }
    } catch (error) {
      logger.error('Failed to create recording directory', {
        error: (error as Error).message,
        path: this.config.recordingPath,
      });
    }
  }

  private flushBuffer(): void {
    if (this.messageBuffer.length === 0 || !this.currentSession) {
      return;
    }

    // Add buffered messages to session
    this.currentSession.messages.push(...this.messageBuffer);
    this.messageBuffer = [];

    // Save incrementally
    this.saveRecording();

    logger.debug('Flushed message buffer', {
      messageCount: this.currentSession.messages.length,
      totalSize: `${Math.round(this.totalRecordedSize / 1024)}KB`,
    });
  }

  private saveRecording(): void {
    if (!this.currentSession || !this.recordingFilePath) {
      return;
    }

    try {
      const data = JSON.stringify(this.currentSession, null, 2);
      fs.writeFileSync(this.recordingFilePath, data, 'utf8');
    } catch (error) {
      logger.error('Failed to save recording', {
        error: (error as Error).message,
        recordingFile: this.recordingFilePath,
      });
    }
  }

  /**
   * Check if a message is a keep-alive message that should be filtered
   */
  private isKeepAliveMessage(rawMessage: string, messageType: string): boolean {
    // Filter empty JSON objects and UNKNOWN message types
    if (
      messageType === 'UNKNOWN' &&
      (rawMessage === '{}' || rawMessage.trim() === '{}')
    ) {
      return true;
    }

    // Filter SignalR heartbeat messages
    if (rawMessage.length <= 2 && rawMessage.trim() === '{}') {
      return true;
    }

    return false;
  }
}

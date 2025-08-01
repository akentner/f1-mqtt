#!/usr/bin/env node

/**
 * Session Recording Analysis and Conversion Tool
 * 
 * This tool provides utilities for analyzing and converting F1 session recordings
 * between different recording modes.
 */

const fs = require('fs');
const path = require('path');

class RecordingAnalyzer {
  /**
   * Analyze a recording file
   */
  static analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const analysis = {
      file: {
        path: filePath,
        size: stats.size,
        sizeFormatted: this.formatBytes(stats.size),
        lastModified: stats.mtime.toISOString(),
      },
      metadata: content.metadata,
      messages: {
        total: content.messages.length,
        types: this.analyzeMessageTypes(content.messages),
        timespan: this.analyzeTimespan(content.messages),
        dataDistribution: this.analyzeDataDistribution(content.messages),
      },
      efficiency: this.calculateEfficiency(content),
    };

    return analysis;
  }

  /**
   * Convert recording between modes
   */
  static convertRecording(inputPath, outputPath, targetMode) {
    const content = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const originalMode = content.metadata.recordingMode || 'structured';
    
    if (originalMode === targetMode) {
      console.log(`Recording is already in ${targetMode} mode`);
      return;
    }

    const convertedContent = this.convertMessages(content, targetMode);
    convertedContent.metadata.recordingMode = targetMode;
    convertedContent.metadata.convertedFrom = originalMode;
    convertedContent.metadata.convertedAt = new Date().toISOString();

    fs.writeFileSync(outputPath, JSON.stringify(convertedContent, null, 2));
    
    const originalSize = fs.statSync(inputPath).size;
    const newSize = fs.statSync(outputPath).size;
    const reduction = Math.round((1 - newSize / originalSize) * 100);
    
    console.log(`Converted ${originalMode} → ${targetMode}`);
    console.log(`Size: ${this.formatBytes(originalSize)} → ${this.formatBytes(newSize)} (${reduction > 0 ? reduction + '% reduction' : Math.abs(reduction) + '% increase'})`);
  }

  /**
   * Convert messages based on target mode
   */
  static convertMessages(content, targetMode) {
    const convertedContent = JSON.parse(JSON.stringify(content)); // Deep clone
    
    convertedContent.messages = content.messages.map(message => {
      switch (targetMode) {
        case 'raw':
          return {
            timestamp: message.timestamp,
            relativeTime: message.relativeTime,
            messageType: message.messageType,
            direction: message.direction,
            rawMessage: message.rawMessage,
            dataSize: message.dataSize,
          };
        
        case 'structured':
          return {
            ...message,
            parsedMessage: message.parsedMessage || this.tryParseMessage(message.rawMessage),
            streamName: message.streamName || 'Unknown',
          };
        
        case 'hybrid':
          const importantTypes = ['RESPONSE_MESSAGE', 'SUBSCRIPTION_MESSAGE'];
          if (importantTypes.includes(message.messageType)) {
            return {
              ...message,
              parsedMessage: message.parsedMessage || this.tryParseMessage(message.rawMessage),
              streamName: message.streamName || 'Unknown',
            };
          } else {
            return {
              timestamp: message.timestamp,
              relativeTime: message.relativeTime,
              messageType: message.messageType,
              direction: message.direction,
              rawMessage: message.rawMessage,
              dataSize: message.dataSize,
              streamName: message.streamName,
            };
          }
        
        default:
          return message;
      }
    });

    return convertedContent;
  }

  /**
   * Try to parse a raw message
   */
  static tryParseMessage(rawMessage) {
    try {
      return JSON.parse(rawMessage);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Analyze message types distribution
   */
  static analyzeMessageTypes(messages) {
    const types = {};
    messages.forEach(msg => {
      types[msg.messageType] = (types[msg.messageType] || 0) + 1;
    });
    return types;
  }

  /**
   * Analyze timespan of recording
   */
  static analyzeTimespan(messages) {
    if (messages.length === 0) return null;
    
    const first = messages[0];
    const last = messages[messages.length - 1];
    
    return {
      start: first.timestamp,
      end: last.timestamp,
      durationMs: last.relativeTime,
      durationFormatted: this.formatDuration(last.relativeTime),
    };
  }

  /**
   * Analyze data size distribution
   */
  static analyzeDataDistribution(messages) {
    const sizes = messages.map(m => m.dataSize || 0);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    
    return {
      totalBytes: total,
      totalFormatted: this.formatBytes(total),
      averageBytes: Math.round(total / messages.length),
      minBytes: Math.min(...sizes),
      maxBytes: Math.max(...sizes),
    };
  }

  /**
   * Calculate recording efficiency metrics
   */
  static calculateEfficiency(content) {
    const messages = content.messages;
    const structuredMessages = messages.filter(m => m.parsedMessage);
    const rawOnlyMessages = messages.filter(m => !m.parsedMessage);
    
    return {
      structuredMessages: structuredMessages.length,
      rawOnlyMessages: rawOnlyMessages.length,
      structuredPercentage: Math.round((structuredMessages.length / messages.length) * 100),
      estimatedRawSize: this.estimateRawSize(content),
      estimatedStructuredSize: this.estimateStructuredSize(content),
    };
  }

  /**
   * Estimate size if converted to raw mode
   */
  static estimateRawSize(content) {
    const rawData = this.convertMessages(content, 'raw');
    return Buffer.byteLength(JSON.stringify(rawData), 'utf8');
  }

  /**
   * Estimate size if converted to structured mode
   */
  static estimateStructuredSize(content) {
    const structuredData = this.convertMessages(content, 'structured');
    return Buffer.byteLength(JSON.stringify(structuredData), 'utf8');
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration to human readable
   */
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'analyze':
        if (args.length < 2) {
          console.error('Usage: node recording-tools.js analyze <file-path>');
          process.exit(1);
        }
        const analysis = RecordingAnalyzer.analyzeFile(args[1]);
        console.log(JSON.stringify(analysis, null, 2));
        break;

      case 'convert':
        if (args.length < 4) {
          console.error('Usage: node recording-tools.js convert <input-file> <output-file> <mode>');
          console.error('Modes: raw, structured, hybrid');
          process.exit(1);
        }
        RecordingAnalyzer.convertRecording(args[1], args[2], args[3]);
        break;

      case 'compare':
        if (args.length < 2) {
          console.error('Usage: node recording-tools.js compare <directory>');
          process.exit(1);
        }
        const dir = args[1];
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        
        console.log('Recording Comparison:\n');
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const analysis = RecordingAnalyzer.analyzeFile(filePath);
          console.log(`${file}:`);
          console.log(`  Mode: ${analysis.metadata.recordingMode || 'unknown'}`);
          console.log(`  Size: ${analysis.file.sizeFormatted}`);
          console.log(`  Messages: ${analysis.messages.total}`);
          console.log(`  Duration: ${analysis.messages.timespan?.durationFormatted || 'unknown'}`);
          console.log('');
        });
        break;

      default:
        console.log('F1 Session Recording Analysis Tool\n');
        console.log('Commands:');
        console.log('  analyze <file>              - Analyze a recording file');
        console.log('  convert <input> <output> <mode> - Convert recording mode');
        console.log('  compare <directory>         - Compare recordings in directory');
        console.log('\nRecording Modes: raw, structured, hybrid');
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = RecordingAnalyzer;

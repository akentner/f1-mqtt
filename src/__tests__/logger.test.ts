import { Logger } from '../utils/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('debug', true, false);
  });

  afterEach(() => {
    logger.removeAllListeners();
  });

  it('should create logger with correct level', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log debug messages when level is debug', () => {
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    logger.debug('Test debug message');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('DEBUG: Test debug message')
    );
    
    consoleSpy.mockRestore();
  });

  it('should not log debug messages when level is info', () => {
    const infoLogger = new Logger('info', true, false);
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    infoLogger.debug('Test debug message');
    
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should emit log events', (done) => {
    logger.on('log', (logEvent) => {
      expect(logEvent.level).toBe('info');
      expect(logEvent.message).toBe('Test message');
      expect(logEvent.timestamp).toBeInstanceOf(Date);
      done();
    });

    logger.info('Test message');
  });

  it('should include metadata in log messages', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const meta = { userId: 123, action: 'test' };
    
    logger.info('Test message with meta', meta);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Test message with meta')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify(meta))
    );
    
    consoleSpy.mockRestore();
  });
});

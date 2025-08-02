import { MqttPublisher } from '../services/mqtt-publisher';
import { MqttConfig } from '../types';

describe('MQTT Pattern Matching', () => {
  let publisher: MqttPublisher;
  let mockConfig: MqttConfig;

  beforeEach(() => {
    mockConfig = {
      brokerUrl: 'mqtt://test:1883',
      topicPrefix: 'f1',
      retainedTopics: [
        'sessioninfo',
        'sessiondata',
        '+/status',
        '+/discovery',
        'weather/#',
        'timing/+/sector1',
      ],
    };
    publisher = new MqttPublisher(mockConfig);
  });

  describe('MQTT Standard Wildcards', () => {
    test('should match exact topic patterns', () => {
      const shouldRetain = (publisher as any).shouldRetainTopic(
        'f1/sessioninfo'
      );
      expect(shouldRetain).toBe(true);
    });

    test('should match single-level wildcard (+)', () => {
      const shouldRetain1 = (publisher as any).shouldRetainTopic(
        'f1/driver1/status'
      );
      const shouldRetain2 = (publisher as any).shouldRetainTopic(
        'f1/session/status'
      );
      const shouldRetain3 = (publisher as any).shouldRetainTopic(
        'f1/track/status'
      );

      expect(shouldRetain1).toBe(true);
      expect(shouldRetain2).toBe(true);
      expect(shouldRetain3).toBe(true);
    });

    test('should match multi-level wildcard (#)', () => {
      const shouldRetain1 = (publisher as any).shouldRetainTopic(
        'f1/weather/temperature'
      );
      const shouldRetain2 = (publisher as any).shouldRetainTopic(
        'f1/weather/humidity/current'
      );
      const shouldRetain3 = (publisher as any).shouldRetainTopic(
        'f1/weather/wind/speed/kmh'
      );

      expect(shouldRetain1).toBe(true);
      expect(shouldRetain2).toBe(true);
      expect(shouldRetain3).toBe(true);
    });

    test('should not match incorrect patterns', () => {
      const shouldRetain1 = (publisher as any).shouldRetainTopic(
        'f1/driver1/position'
      ); // not status
      const shouldRetain2 = (publisher as any).shouldRetainTopic(
        'f1/other/data'
      ); // not in patterns
      const shouldRetain3 = (publisher as any).shouldRetainTopic(
        'f1/timing/driver1/sector2'
      ); // not sector1

      expect(shouldRetain1).toBe(false);
      expect(shouldRetain2).toBe(false);
      expect(shouldRetain3).toBe(false);
    });

    test('should handle complex patterns correctly', () => {
      const shouldRetain1 = (publisher as any).shouldRetainTopic(
        'f1/timing/driver5/sector1'
      );
      const shouldRetain2 = (publisher as any).shouldRetainTopic(
        'f1/timing/session/sector1'
      );

      expect(shouldRetain1).toBe(true);
      expect(shouldRetain2).toBe(true);
    });
  });

  describe('Pattern Validation', () => {
    test('should validate # wildcard position', () => {
      // # must be at the end
      const matchesMqttPattern = (publisher as any).matchesMqttPattern;

      // Valid patterns
      expect(matchesMqttPattern('weather/temp', 'weather/#')).toBe(true);
      expect(matchesMqttPattern('weather', '#')).toBe(true);

      // Should log warning for invalid patterns but still process
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      expect(matchesMqttPattern('weather/temp', 'weather/#/invalid')).toBe(
        false
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle edge cases', () => {
      const matchesMqttPattern = (publisher as any).matchesMqttPattern;

      expect(matchesMqttPattern('', '')).toBe(true);
      expect(matchesMqttPattern('test', '+')).toBe(true);
      expect(matchesMqttPattern('test/subtopic', '+/+')).toBe(true);
      expect(matchesMqttPattern('test', '#')).toBe(true);
    });
  });

  describe('Topic Prefix Handling', () => {
    test('should strip topic prefix correctly', () => {
      const shouldRetain = (publisher as any).shouldRetainTopic(
        'f1/sessioninfo'
      );
      expect(shouldRetain).toBe(true);
    });

    test('should handle topics without prefix', () => {
      const shouldRetain = (publisher as any).shouldRetainTopic('sessioninfo');
      expect(shouldRetain).toBe(true);
    });
  });
});

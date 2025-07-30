import { EventProcessor } from '../services/event-processor';
import { SignalRClient } from '../services/signalr-client';
import { MqttPublisher } from '../services/mqtt-publisher';

// Mock the dependencies
jest.mock('../services/signalr-client');
jest.mock('../services/mqtt-publisher');
jest.mock('../utils/logger');

describe('EventProcessor', () => {
  let eventProcessor: EventProcessor;
  let mockSignalRClient: jest.Mocked<SignalRClient>;
  let mockMqttPublisher: jest.Mocked<MqttPublisher>;

  beforeEach(() => {
    mockSignalRClient = new SignalRClient({
      hubUrl: 'test-url',
      hubName: 'test-hub',
    }) as jest.Mocked<SignalRClient>;

    mockMqttPublisher = new MqttPublisher({
      brokerUrl: 'mqtt://test',
    }) as jest.Mocked<MqttPublisher>;

    // Mock the methods
    mockSignalRClient.on = jest.fn();
    mockSignalRClient.isConnected = jest.fn().mockReturnValue(true);
    mockSignalRClient.connect = jest.fn().mockResolvedValue(undefined);
    mockSignalRClient.disconnect = jest.fn().mockResolvedValue(undefined);

    mockMqttPublisher.on = jest.fn();
    mockMqttPublisher.getConnectionStatus = jest.fn().mockReturnValue(true);
    mockMqttPublisher.connect = jest.fn().mockResolvedValue(undefined);
    mockMqttPublisher.disconnect = jest.fn().mockResolvedValue(undefined);
    mockMqttPublisher.publishF1Event = jest.fn().mockResolvedValue(undefined);

    eventProcessor = new EventProcessor(mockSignalRClient, mockMqttPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create event processor', () => {
    expect(eventProcessor).toBeInstanceOf(EventProcessor);
  });

  it('should start successfully when both clients connect', async () => {
    await eventProcessor.start();

    expect(mockMqttPublisher.connect).toHaveBeenCalled();
    expect(mockSignalRClient.connect).toHaveBeenCalled();
  });

  it('should stop gracefully', async () => {
    await eventProcessor.stop();

    expect(mockSignalRClient.disconnect).toHaveBeenCalled();
    expect(mockMqttPublisher.disconnect).toHaveBeenCalled();
  });

  it('should return correct status', () => {
    const status = eventProcessor.getStatus();

    expect(status).toHaveProperty('queueSize');
    expect(status).toHaveProperty('processing');
    expect(status).toHaveProperty('signalRConnected');
    expect(status).toHaveProperty('mqttConnected');
    expect(status.signalRConnected).toBe(true);
    expect(status.mqttConnected).toBe(true);
  });

  it('should handle SignalR connection errors', async () => {
    const error = new Error('Connection failed');
    mockSignalRClient.connect.mockRejectedValue(error);

    await expect(eventProcessor.start()).rejects.toThrow('Connection failed');
  });

  it('should handle MQTT connection errors', async () => {
    const error = new Error('MQTT connection failed');
    mockMqttPublisher.connect.mockRejectedValue(error);

    await expect(eventProcessor.start()).rejects.toThrow('MQTT connection failed');
  });
});

# Session Recording Modes

This document describes the different recording modes available in the F1 Session Recording System.

## Available Recording Modes

The system supports four different recording modes, each optimized for different use cases:

### 1. `disabled` - No Recording
- **File Size**: 0 bytes
- **Performance**: Minimal overhead
- **Use Case**: When recording is not needed

### 2. `raw` - Raw Messages Only
- **File Size**: ~6MB for practice session (70% reduction)
- **Content**: Only raw SignalR messages with basic timestamps
- **Performance**: Fastest, minimal processing
- **Use Case**: Production environments, storage efficiency priority
- **Trade-offs**: No parsed data, no stream metadata

#### Raw Mode Structure
```json
{
  "metadata": {
    "sessionId": "abc123",
    "recordingMode": "raw",
    "messageCount": 15420,
    "totalSize": 6234567
  },
  "messages": [
    {
      "timestamp": "2025-08-01T14:24:03.837Z",
      "relativeTime": 1234,
      "messageType": "SUBSCRIPTION_MESSAGE",
      "direction": "incoming",
      "rawMessage": "{\"R\":[\"2024-08-31_Practice_1\",\"[\u001f...]\"]}",
      "dataSize": 1024
    }
  ]
}
```

### 3. `structured` - Full Structured Data
- **File Size**: ~19MB for practice session (reference size)
- **Content**: Full parsed messages, stream metadata, complete information
- **Performance**: More processing overhead for parsing
- **Use Case**: Development, debugging, detailed analysis
- **Features**: Complete data with all metadata

#### Structured Mode Structure
```json
{
  "metadata": {
    "sessionId": "abc123",
    "recordingMode": "structured",
    "messageCount": 15420,
    "totalSize": 19234567
  },
  "messages": [
    {
      "timestamp": "2025-08-01T14:24:03.837Z",
      "relativeTime": 1234,
      "messageType": "SUBSCRIPTION_MESSAGE",
      "direction": "incoming",
      "rawMessage": "{\"R\":[\"2024-08-31_Practice_1\",\"[\u001f...]\"]}",
      "parsedMessage": {
        "R": ["2024-08-31_Practice_1", "[compressed_data]"]
      },
      "streamName": "SessionInfo",
      "dataSize": 1024
    }
  ]
}
```

### 4. `hybrid` - Smart Hybrid Mode
- **File Size**: ~12MB for practice session (40% reduction)
- **Content**: Structured data for important messages, raw for others
- **Performance**: Balanced processing overhead
- **Use Case**: Development with storage efficiency
- **Smart Logic**: Only parse important message types

#### Important Message Types (Structured)
- `RESPONSE_MESSAGE` - Initial session data and responses
- `SUBSCRIPTION_MESSAGE` - Stream subscription confirmations

#### Other Message Types (Raw)
- Keep-alive messages
- Heartbeat messages
- Routine updates

## Configuration

### Environment Variable
```bash
# Set the recording mode
SESSION_RECORDING_MODE=hybrid
```

### Valid Values
- `disabled` - No recording
- `raw` - Raw messages only
- `structured` - Full structured data (default)
- `hybrid` - Smart hybrid mode

## Performance Comparison

| Mode | File Size | Processing | Memory | Best For |
|------|-----------|------------|---------|----------|
| `disabled` | 0 MB | None | Minimal | No recording needed |
| `raw` | ~6 MB | Minimal | Low | Production efficiency |
| `hybrid` | ~12 MB | Moderate | Medium | Development balance |
| `structured` | ~19 MB | High | High | Full development features |

## Use Case Recommendations

### Production Deployment
```bash
SESSION_RECORDING_MODE=raw
SESSION_RECORDING_FILTER_KEEP_ALIVE=false
```
- Minimal storage usage
- Fastest performance
- Still captures all raw data for analysis

### Development Environment
```bash
SESSION_RECORDING_MODE=hybrid
SESSION_RECORDING_FILTER_KEEP_ALIVE=true
```
- Good balance of features and efficiency
- Structured data for important messages
- Filtered keep-alive messages

### Debugging/Analysis
```bash
SESSION_RECORDING_MODE=structured
SESSION_RECORDING_FILTER_KEEP_ALIVE=false
```
- Complete data with all metadata
- Full parsing information
- All messages preserved

## Migration and Compatibility

### Backwards Compatibility
- Existing recordings remain compatible
- New recordings include `recordingMode` in metadata
- Replay server handles all formats

### Converting Between Modes
- Raw → Structured: Requires re-recording or raw message parsing
- Structured → Raw: Can extract raw messages from existing recordings
- Hybrid → Any: Contains both raw and structured data where available

## File Size Analysis

Based on real F1 practice session data:

| Recording Mode | File Size | Size Reduction | Messages Parsed |
|---------------|-----------|----------------|-----------------|
| Structured | 19.2 MB | 0% (baseline) | All messages |
| Hybrid | 12.1 MB | 37% reduction | Important only |
| Raw | 5.8 MB | 70% reduction | None |

## Best Practices

1. **Development**: Use `hybrid` mode for balanced features and efficiency
2. **Production**: Use `raw` mode for minimal storage overhead
3. **Analysis**: Use `structured` mode for complete data access
4. **Testing**: Use `hybrid` or `structured` based on testing needs

## Future Enhancements

- **Compression**: Additional file compression for all modes
- **Streaming**: Real-time streaming of recordings
- **Selective Recording**: Record only specific message types
- **Format Conversion**: Tools to convert between recording modes

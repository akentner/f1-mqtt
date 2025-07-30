<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# F1 MQTT Bridge - Copilot Instructions

## Project Overview
This is a TypeScript-based server application that bridges F1 timing data from SignalR to MQTT for Home Assistant integration.

## Architecture Principles
- Use TypeScript for type safety and better code quality
- Follow SOLID principles and dependency injection patterns
- Implement proper error handling and logging throughout
- Use async/await for asynchronous operations
- Maintain clean separation of concerns between services

## Code Style Guidelines
- Use strict TypeScript configuration (`exactOptionalPropertyTypes: true`)
- Follow ESLint and Prettier configurations defined in the project
- Use meaningful variable and function names
- Add JSDoc comments for public methods and classes
- Prefer composition over inheritance
- Use EventEmitter pattern for service communication

## Project Structure
- `src/services/` - Core business logic services
- `src/types/` - TypeScript type definitions
- `src/config/` - Configuration management
- `src/utils/` - Utility functions and helpers
- `src/__tests__/` - Unit tests using Jest

## Key Services
1. **SignalRClient** - Manages connection to F1 SignalR hub
2. **MqttPublisher** - Handles MQTT message publishing
3. **EventProcessor** - Processes and transforms F1 events
4. **HealthServer** - Provides HTTP health check endpoints

## Testing Guidelines
- Write unit tests for all services
- Mock external dependencies (SignalR, MQTT)
- Use Jest for testing framework
- Aim for good test coverage, especially for business logic
- Test error handling scenarios

## Docker & DevContainer
- The project uses DevContainer for consistent development environment
- Home Assistant addon support is prepared in `homeassistant/` directory
- Use multi-stage builds for optimized production images

## Environment Configuration
- Use environment variables for all configuration
- Provide sensible defaults
- Support both development and production environments
- Validate configuration on startup

## Error Handling
- Use structured logging with different log levels
- Implement graceful shutdown handling
- Handle connection failures and reconnection logic
- Provide meaningful error messages

## Home Assistant Integration
- Support automatic device discovery
- Follow Home Assistant MQTT naming conventions
- Provide status and availability topics
- Include device metadata in MQTT messages

## Performance Considerations
- Use batch processing for high-frequency events
- Implement proper backpressure handling
- Monitor memory usage and prevent leaks
- Use connection pooling where applicable

## Security Best Practices
- Run as non-root user in containers
- Use environment variables for sensitive data
- Validate input data
- Implement proper authentication when required

When suggesting code changes:
1. Ensure TypeScript types are correctly defined
2. Follow the existing error handling patterns
3. Add appropriate logging statements
4. Consider the Home Assistant integration requirements
5. Maintain consistency with the existing code style

#!/bin/bash

# F1 Development Environment Setup Script

set -e

echo "🏎️  F1 Development Environment Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Make sure you're in the test-server directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_status "Dependencies already installed"
fi

# Check what the user wants to do
case "${1:-help}" in
    "start"|"server")
        print_status "Starting F1 Mock Server..."
        npm start
        ;;
    
    "dev"|"development")
        print_status "Starting F1 Mock Server in development mode..."
        npm run dev
        ;;
    
    "docker")
        print_status "Starting with Docker Compose..."
        docker-compose up --build
        ;;
    
    "docker-detached"|"docker-d")
        print_status "Starting with Docker Compose (detached)..."
        docker-compose up --build -d
        print_success "Services started in background"
        print_status "Check status with: docker-compose ps"
        print_status "View logs with: docker-compose logs -f"
        print_status "Stop with: docker-compose down"
        ;;
    
    "stop")
        print_status "Stopping Docker services..."
        docker-compose down
        print_success "Services stopped"
        ;;
    
    "logs")
        print_status "Showing Docker logs..."
        docker-compose logs -f
        ;;
    
    "status")
        print_status "Checking service status..."
        if docker-compose ps | grep -q "Up"; then
            print_success "Services are running:"
            docker-compose ps
        else
            print_warning "No services are currently running"
        fi
        ;;
    
    "switch-dev")
        print_status "Switching main application to development mode..."
        node switch-environment.js development
        print_success "Switched to development environment (using .env files)"
        print_warning "Remember to start the mock server!"
        ;;
    
    "switch-prod")
        print_status "Switching main application to production mode..."
        node switch-environment.js production
        print_success "Switched to production environment (using .env files)"
        ;;
    
    "env-status")
        print_status "Checking environment configuration..."
        node switch-environment.js status
        ;;
    
    "test")
        print_status "Testing the mock server..."
        
        # Start server in background
        npm start &
        SERVER_PID=$!
        
        # Wait for server to start
        sleep 3
        
        # Test endpoints
        print_status "Testing health endpoint..."
        if curl -s http://localhost:3001/health > /dev/null; then
            print_success "Health endpoint OK"
        else
            print_error "Health endpoint failed"
        fi
        
        print_status "Testing negotiate endpoint..."
        if curl -s http://localhost:3001/signalr/negotiate > /dev/null; then
            print_success "Negotiate endpoint OK"
        else
            print_error "Negotiate endpoint failed"
        fi
        
        # Stop server
        kill $SERVER_PID
        print_success "Test completed"
        ;;
    
    "help"|*)
        echo "F1 Development Environment Commands:"
        echo ""
        echo "Server Management:"
        echo "  start, server     - Start mock server"
        echo "  dev, development  - Start mock server with auto-reload"
        echo "  docker           - Start with Docker Compose"
        echo "  docker-d         - Start with Docker Compose (detached)"
        echo "  stop             - Stop Docker services"
        echo "  logs             - Show Docker logs"
        echo "  status           - Check service status"
        echo ""
        echo "Environment Switching:"
        echo "  switch-dev       - Switch main app to development (.env method)"
        echo "  switch-prod      - Switch main app to production (.env method)"
        echo "  env-status       - Show current environment configuration"
        echo ""
        echo "Testing:"
        echo "  test             - Run basic connectivity tests"
        echo ""
        echo "Examples:"
        echo "  ./setup.sh dev                 # Start development server"
        echo "  ./setup.sh docker-d            # Start full stack in background"
        echo "  ./setup.sh switch-dev          # Use mock server in main app"
        echo "  ./setup.sh switch-prod         # Use real F1 API in main app"
        echo ""
        echo "URLs when running:"
        echo "  Mock Server:     http://localhost:3001"
        echo "  Health Check:    http://localhost:3001/health"
        echo "  MQTT Broker:     localhost:1883"
        echo "  MQTT WebSocket:  localhost:9001"
        ;;
esac

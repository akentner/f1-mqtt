#!/bin/bash
# ==============================================================================
# Home Assistant Add-on: F1 MQTT Bridge
# Build script for creating the Home Assistant add-on
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ADDON_NAME="f1-mqtt-bridge"
ADDON_VERSION="1.0.0"
REGISTRY="ghcr.io"
NAMESPACE="your-username"

# Build arguments
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
BUILD_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_REPOSITORY="your-username/f1-mqtt-bridge"

echo -e "${BLUE}🏎️  Building F1 MQTT Bridge Home Assistant Add-on${NC}"
echo "======================================================"

# Ensure we're in the project root
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Building TypeScript application...${NC}"
npm run build

echo -e "${YELLOW}🔧 Preparing add-on files...${NC}"

# Create build directory
mkdir -p build/homeassistant
cp -r homeassistant/* build/homeassistant/
cp -r dist build/homeassistant/
cp package.json build/homeassistant/

# Build for each architecture
architectures=("aarch64" "amd64" "armhf" "armv7" "i386")

for arch in "${architectures[@]}"; do
    echo -e "${YELLOW}🏗️  Building for architecture: ${arch}${NC}"
    
    docker build \
        --build-arg BUILD_FROM="ghcr.io/hassio-addons/base:18.0.3" \
        --build-arg BUILD_ARCH="${arch}" \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg BUILD_DESCRIPTION="Bridge F1 timing data from SignalR to MQTT" \
        --build-arg BUILD_NAME="F1 MQTT Bridge" \
        --build-arg BUILD_REF="${BUILD_REF}" \
        --build-arg BUILD_REPOSITORY="${BUILD_REPOSITORY}" \
        --build-arg BUILD_VERSION="${ADDON_VERSION}" \
        --tag "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-${arch}" \
        --tag "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest-${arch}" \
        --file build/homeassistant/Dockerfile \
        build/homeassistant/
    
    echo -e "${GREEN}✅ Built for ${arch}${NC}"
done

echo -e "${YELLOW}📤 Creating multi-architecture manifest...${NC}"

# Create multi-arch manifest
docker manifest create "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-aarch64" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-amd64" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-armhf" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-armv7" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-i386"

docker manifest create "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest-aarch64" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest-amd64" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest-armhf" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest-armv7" \
    "${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest-i386"

echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo ""
echo "To push to registry:"
echo "  docker manifest push ${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}"
echo "  docker manifest push ${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:latest"
echo ""
echo "To test locally:"
echo "  docker run --rm -it ${REGISTRY}/${NAMESPACE}/${ADDON_NAME}:${ADDON_VERSION}-amd64"

# Cleanup
rm -rf build/

# Production Dockerfile
FROM node:20-alpine

# Installiere zusätzliche Tools für Home Assistant Addon Support
RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    mosquitto-clients

# Erstelle Arbeitsverzeichnis
WORKDIR /app

# Kopiere Package-Dateien zuerst (für besseres Caching)
COPY package*.json ./

# Installiere alle Dependencies (inklusive dev für build)
RUN npm ci

# Kopiere Quellcode
COPY . .

# Baue das Projekt
RUN npm run build

# Entferne dev dependencies für kleinere Image-Größe
RUN npm ci --only=production && npm cache clean --force

# Benutzer erstellen (für Security)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Wechsle zu nodejs user
USER nodejs

# Exponiere Ports
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Startkommando mit Garbage Collection aktiviert
CMD ["node", "--expose-gc", "--max-old-space-size=512", "dist/index.js"]

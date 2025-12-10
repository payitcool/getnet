# Use Node.js LTS version
FROM node:18-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port (will be overridden by $PORT)
EXPOSE $PORT

# Health check - verifica cada 30s, timeout 5s, espera 10s al inicio, 3 reintentos
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/healthz || exit 1

# Start the application
CMD ["npm", "start"]

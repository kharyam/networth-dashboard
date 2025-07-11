# Build stage
FROM docker.io/node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# NPM Install if needed
RUN [ ! -f package-lock.json ] && npm install || true

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM docker.io/nginx:alpine

# Install wget for health checks
RUN apk add --no-cache wget tzdata

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN adduser -D -g '' -s /bin/sh appuser

# Change ownership of nginx directories
RUN chown -R appuser:appuser /usr/share/nginx/html \
    && chown -R appuser:appuser /var/cache/nginx \
    && chown -R appuser:appuser /var/log/nginx \
    && chown -R appuser:appuser /etc/nginx/conf.d

# Make sure nginx can bind to port 80
RUN touch /var/run/nginx.pid \
    && chown -R appuser:appuser /var/run/nginx.pid

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

ENV TZ=America/New_York

# Start nginx
CMD nginx -g "daemon off;"

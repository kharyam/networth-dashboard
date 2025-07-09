# Build stage
FROM docker.io/golang:1.23-alpine AS builder

# Install git and ca-certificates
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app

# Copy source code first
COPY . .

# Download dependencies and generate go.sum
RUN go mod download && go mod tidy

# Install swag CLI tool for generating Swagger documentation
RUN go install github.com/swaggo/swag/cmd/swag@latest

# Generate Swagger documentation
RUN swag init

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM docker.io/alpine:latest

# Install ca-certificates and wget for health checks
RUN apk --no-cache add ca-certificates wget tzdata

# Create non-root user
RUN adduser -D -g '' appuser

# Set working directory to user home
WORKDIR /home/appuser

# Copy binary from builder stage
COPY --from=builder /app/main .

# Copy generated Swagger documentation
COPY --from=builder /app/docs ./docs

# Change ownership and make executable
RUN chown -R appuser:appuser main docs && chmod +x main

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENV TZ=America/New_York

# Run the application
CMD ["./main"]

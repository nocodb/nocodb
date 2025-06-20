# Use official Node.js runtime as the base image
FROM node:22.12.0-bullseye-slim

# Set environment variables early
ENV NODE_ENV=production
ENV PORT=4444
ENV NPM_CONFIG_CACHE=/tmp/.npm

# Install PostgreSQL client tools and curl for health checks
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create a non-root user for security (before WORKDIR to avoid permission issues)
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/false appuser

# Set the working directory and ensure proper ownership
WORKDIR /app
RUN chown appuser:appuser /app

# Switch to non-root user for package installation
USER appuser

# Copy package files with proper ownership
COPY --chown=appuser:appuser package*.json ./

# Install Node.js dependencies (use npm ci for production builds)
RUN npm ci --only=production --silent && npm cache clean --force

# Copy the application code with proper ownership
COPY --chown=appuser:appuser index.js ./

# Create tmp directory for migration files with proper permissions
RUN mkdir -p /tmp/migrations && chmod 755 /tmp/migrations

# Expose the port the app runs on
EXPOSE 4444

# Health check with dedicated endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-4444}/api/v1/health || exit 1

# Use exec form and run directly with node for better signal handling
CMD ["node", "index.js"] 
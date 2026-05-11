# Open Framework — Docker Deployment
# Runs the Express server in a container

FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the Express server
CMD ["node", "src/server/interfaces/api/express/server.js"]

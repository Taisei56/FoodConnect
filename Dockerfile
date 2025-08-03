# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ src/
COPY ecosystem.config.js ./

# Create uploads directory
RUN mkdir -p src/public/uploads

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
               const options = { host: 'localhost', port: 3000, path: '/api/health', timeout: 2000 }; \
               const req = http.request(options, (res) => { \
                 if (res.statusCode === 200) process.exit(0); \
                 else process.exit(1); \
               }); \
               req.on('error', () => process.exit(1)); \
               req.end();"

# Run the application
CMD ["npm", "start"]
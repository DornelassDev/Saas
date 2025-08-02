FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 py3-pip git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create clients directory
RUN mkdir -p /app/clients

# Expose port range for client projects
EXPOSE 3001-3020

# Start the monitoring agent
CMD ["npm", "start"]
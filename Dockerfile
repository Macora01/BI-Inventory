# Base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]

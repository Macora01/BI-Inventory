# Stage 1: Build
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies including devDependencies for the build
# We force devDependencies in case the environment has NODE_ENV=production
RUN npm install --include=dev

COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim AS runtime

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built files from the build stage
COPY --from=build /app/dist ./dist
# Copy the server and other necessary files
COPY --from=build /app/server.ts ./
COPY --from=build /app/version.ts ./
COPY --from=build /app/types.ts ./
# Copy initial data directory
COPY --from=build /app/data ./data

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start command (using local tsx to run the TypeScript server in production)
CMD ["./node_modules/.bin/tsx", "server.ts"]

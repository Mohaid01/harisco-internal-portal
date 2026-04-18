# Stage 1: Build the React frontend
FROM node:18-alpine AS builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Setup the Express backend and serve the frontend
FROM node:18-alpine

WORKDIR /app/server

# Install backend dependencies
COPY server/package*.json ./
RUN npm install

# Copy backend source
COPY server/ ./

# Generate Prisma Client
RUN npx prisma generate

# Build the backend TS code
RUN npm run build

# Copy the built React app to the backend's static directory
# We will serve this from Express!
COPY --from=builder /app/client/dist ./public

# Expose the API port
EXPOSE 5000

# Start the server using the compiled JS
CMD ["npm", "run", "start"]

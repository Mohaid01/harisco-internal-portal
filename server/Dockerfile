# Build stage
FROM node:20-slim AS builder
# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate

# Production stage
FROM node:20-slim
# Install openssl in production too
RUN apt-get update && apt-get install -y openssl libssl-dev
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000
CMD ["npm", "run", "start"]

# Build stage for client
FROM node:18-alpine AS client-build

WORKDIR /app/client

# Copy and install client dependencies
COPY Kribble-Client/package*.json ./

RUN npm install

# Copy client source and build
COPY Kribble-Client/. ./



RUN npm run build

# Build stage for server
FROM node:23-alpine AS server-build

WORKDIR /app

# Copy server dependencies and install
COPY Kribble-Server/package*.json ./

RUN npm install

# Copy server source and build
COPY Kribble-Server/. ./



RUN npm run build

# Production stage
FROM node:23-alpine

WORKDIR /app

# Copy server built files
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/package*.json ./

# Copy client built files
COPY --from=client-build /app/client/build ./Kribble-Client/build


# Expose port for backend
EXPOSE 5000

CMD [ "npm", "run", "start" ]

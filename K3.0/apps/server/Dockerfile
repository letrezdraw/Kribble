FROM node:20-alpine

WORKDIR /workspace

COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY packages/shared-types/package*.json packages/shared-types/
COPY packages/game-engine/package*.json packages/game-engine/
COPY packages/drawing-engine/package*.json packages/drawing-engine/

RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev", "--workspace=@kribble/server"]

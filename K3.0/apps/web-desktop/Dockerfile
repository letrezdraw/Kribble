FROM node:20-alpine

WORKDIR /workspace

COPY package*.json ./
COPY apps/web-desktop/package*.json apps/web-desktop/
COPY packages/shared-types/package*.json packages/shared-types/
COPY packages/drawing-engine/package*.json packages/drawing-engine/

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@kribble/web-desktop", "--", "--host", "0.0.0.0", "--port", "5173"]

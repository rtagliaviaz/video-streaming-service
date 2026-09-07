FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN mkdir -p /app/uploads /app/hls

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV VIDEO_FOLDER_PATH=/app/uploads
ENV OUTPUT_FOLDER_PATH=/app/hls

CMD ["node", "dist/index.js"]
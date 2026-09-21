# Video Streaming Service

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?)
![React](https://img.shields.io/badge/React-19-61DAFB?)
![Express](https://img.shields.io/badge/Express-5.2-000000?)
![FFmpeg](https://img.shields.io/badge/FFmpeg-8.0-007808?)
![HLS](https://img.shields.io/badge/HLS-Streaming-FF6B00?)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)
![BullMQ](https://img.shields.io/badge/BullMQ-6-FF0052?)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?)
![GPU Acceleration](https://img.shields.io/badge/GPU-NVENC-76B900?logo=nvidia)
![License](https://img.shields.io/badge/License-MIT-green)

A self-hosted HLS (HTTP Live Streaming) video streaming service with GPU acceleration, a persistent job queue, real-time progress via Server-Sent Events, multi-audio track support, adaptive bitrate streaming, subtitle extraction, and sprite sheet thumbnails with seeking preview.

## Index

- [Features](#features)
- [GPU Acceleration (NVENC)](#gpu-acceleration-nvenc)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [Option 1: Docker](#option-1-docker)
  - [Option 2: Local Development](#option-2-local-development)
- [Environment Variables](#environment-variables)
- [Docker Volumes](#docker-volumes)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [License](#license)

## Features


### Streaming & Encoding
- **GPU Acceleration** – Uses NVIDIA NVENC for ultra-fast encoding (20x faster than CPU)
- **Dual Codec Support** – Generates both H.264 (universal) and HEVC (GPU-accelerated on Windows) with automatic client-side selection
- **CMAF / fMP4** – Modern streaming format with `.m4s` segments and `init.mp4` files
- **Adaptive Bitrate Streaming** – 7 quality levels (144p to 1440p) with automatic switching
- **Quality Selection** – Choose which qualities to encode (default: 480p, 720p, 1080p, 1440p) to save processing time
- **Parallel Encoding** – Up to 3 qualities encoded simultaneously with `p-limit`

### Audio & Subtitles
- **Multi-Audio Support** – Handles videos with multiple audio tracks (languages, commentary, etc.)
- **Subtitles** – Extracts subtitles to WebVTT with manual parsing and language selection

### Job Queue & Resilience
- **Persistent Job Queue** – BullMQ + Redis for transcoding jobs that survive server restarts
- **Auto-Resume on Restart** – Pending jobs resume automatically when the backend comes back up
- **Automatic Retry** – Failed jobs retry with exponential backoff (up to 3 attempts)
- **Manual Retry** – Retry failed jobs from the UI
- **Cancel Jobs** – Cancel running or queued jobs via `AbortController` (kills FFmpeg cleanly)
- **FIFO Processing** – Worker processes one video at a time (internal qualities still run in parallel)
- **Temp Cleanup** – Upload files and intermediate outputs are deleted after successful processing

### Real-Time Updates
- **Server-Sent Events (SSE)** – Live progress and video list updates (no polling)
- **Reconnection with Backoff** – SSE reconnects automatically with exponential backoff
- **State Recovery on Refresh** – Active jobs reappear in the UI after a page refresh
- **Event-Driven UI** – Video list refreshes instantly when jobs complete, fail, or are added

### Upload & UX
- **Multi-File Upload** – Select multiple videos and process them in sequence
- **Status Labels** – Every video shows its state: `Queued`, `Processing`, `Ready`, `Failed`, `Missing`
- **Playback Guard** – Only `Ready` videos can be played; others show an explanatory message
- **Bulk Delete** – Select and delete multiple videos at once

### Player
- **Custom Video Player** – Built with HLS.js, with quality, audio, subtitle, and speed selectors
- **Sprite Sheet Thumbnails** – 40 thumbnails (160×90) in a sprite sheet with VTT coordinates
- **Hover Preview** – Thumbnail preview on the progress bar showing the exact frame at that position
- **Buffer Optimization** – Tuned HLS.js config for VOD (buffer length, back-buffer, ABR EWMA for VoD)
- **Cache Headers** – Immutable segments (1 year) and no-cache playlists for optimal browser caching

### Infrastructure
- **Dockerized** – Run the entire stack with a single command
- **Redis Persistence** – AOF enabled for job durability across restarts

## GPU Acceleration (NVENC)

This project supports GPU acceleration using NVIDIA NVENC for **local development** on Windows (with NVIDIA drivers installed).

### Codec Decision Logic

| Platform | GPU | HEVC Support | Encoder Used |
|----------|-----|--------------|--------------|
| Windows | NVIDIA | Yes | `hevc_nvenc` (HEVC) + `h264_nvenc` (H.264) |
| Windows | NVIDIA | No | `h264_nvenc` (H.264) |
| Windows | No | - | `libx264` (CPU) |
| Linux | Any | - | `libx264` (CPU) |

**Important:** When running with Docker (the default deployment method), the container uses the CPU encoder (`libx264`). This is because:

- The Docker image is based on `alpine` (lightweight) which does not include NVIDIA drivers
- Compiling FFmpeg with NVENC support inside Alpine is non-trivial
- GPU passthrough to containers requires additional setup (NVIDIA Container Toolkit on Linux hosts)

For most use cases, CPU encoding is sufficient for moderate video sizes. If you need GPU acceleration in production, consider:

1. Running the backend **outside Docker** on a machine with NVIDIA drivers
2. Using a Linux host with `nvidia-container-toolkit` and a custom Docker image

The application will automatically fall back to CPU if GPU is not available.

## Tech Stack

**Backend**
- Node.js + Express + TypeScript
- FFmpeg with NVENC support (H.264 + HEVC)
- fluent-ffmpeg for ffprobe
- Multer for file uploads
- **p-limit** for concurrent processing control
- **BullMQ** for the job queue
- **Redis** for queue persistence and job state
- **Server-Sent Events (SSE)** for real-time progress

**Frontend**
- React 19 + TypeScript
- HLS.js for video playback (native fMP4/CMAF support)
- Custom hooks for video controls, subtitles, thumbnails, SSE, and job state

**Infrastructure**
- Docker & Docker Compose
- Redis 7 with AOF persistence
- Nginx for serving frontend
- Alpine Linux for lightweight images

**Testing**
- Vitest for unit and integration tests
- Supertest for API testing
- Mocked FFmpeg and external dependencies

---

## Prerequisites

- Node.js (v18+) – for local development
- FFmpeg with NVENC support – for GPU acceleration (optional)
- Docker & Docker Compose – for containerized deployment
- Redis (or use the Docker Compose Redis service) – required for the job queue
- NVIDIA GPU (optional, but recommended for GPU acceleration)

## Quick Start

### Option 1: Docker

1. Clone the repository:
```bash
git clone https://github.com/rtagliaviaz/video-streaming-service.git
cd video-streaming-service
```

2. Create the .env file in the root directory:

```env
NODE_ENV=production
PORT=3001
VIDEO_FOLDER_PATH=./uploads
OUTPUT_FOLDER_PATH=./hls
LOG_LEVEL=info
REDIS_HOST=redis
REDIS_PORT=6379
```

3. Start the services:

```bash
docker-compose up -d --build
```

4. Open your browser at http://localhost:5173

### Option 2: Local Development 

- Redis must be running locally (or in Docker). if using Docker:

```bash
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
```

#### Backend

```bash
cd backend
npm install
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Backend port | `3001` |
| `VIDEO_FOLDER_PATH` | Upload folder path | `./uploads` |
| `OUTPUT_FOLDER_PATH` | HLS output folder path | `./hls` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

## Docker Volumes

- `./uploads` – Temporary uploaded video files (automatically cleaned after processing)
- `./hls` – Generated HLS files (playlists, segments, thumbnails, subtitles)
- `redis-data` – Redis AOF file (persists the job queue across container restarts)

## Keyboard Shortcuts

| Key| Action |
|----------|-------------|
| `Space` / `K` | Play / Pause |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Right Arrow` | Seek forward 5 seconds |
| `Left Arrow` | Seek backward 5 seconds |


## How It Works

### 1. Upload & Enqueue
The user uploads one or more video files through the web interface, selecting the qualities to encode. The backend:

1. Saves the uploaded file to `uploads/`.
2. Registers metadata in `videos.json` with status: `'queued'`.
3. Adds a job to the BullMQ queue (`video-processing`) with `attempts: 3` and exponential backoff
4. Returns the `jobId` and `videoId` to the client

The client opens an SSE connection to `/api/events/:jobId` to receive progress updates.

### 2. GPU Detection
The backend checks:

- `nvidia-smi` for NVIDIA GPU presence
- `ffmpeg -encoders` for `h264_nvenc` and `hevc_nvenc` availability
- Platform (Windows or Linux)

Based on this, it selects the appropriate encoder strategy:

| Platform | GPU | HEVC Support | Encoder Used |
|----------|-----|--------------|--------------|
| Windows | NVIDIA | Yes | `hevc_nvenc` (HEVC) + `h264_nvenc` (H.264) |
| Windows | NVIDIA | No | `h264_nvenc` (H.264) |
| Windows | No | - | `libx264` (CPU) |
| Linux | Any | - | `libx264` (CPU) |

### 3. Processing Pipeline
The BullMQ worker picks up jobs one at a time (`concurrency: 1`). For each job:

- **Cleanup** – Removes the previous output directory if the job is a retry.
- **Thumbnails** – Generates 40 thumbnails (160×90) plus a sprite sheet (8×5 grid) and a VTT file with coordinates.
- **Audio Extraction** – Extracts all audio tracks and creates separate HLS playlists using fMP4.
- **Subtitle Extraction** – Extracts subtitles to WebVTT.
- **Quality Encoding** – Encodes the selected qualities in parallel (up to 3 at a time with `p-limit`):
  - For each quality, generates H.264 (always)
  - If HEVC is available, generates HEVC in parallel
  - Uses fMP4 (`.m4s` + `init_*.mp4`)
- **Master Playlist** – Generates `index.m3u8` with `CODECS` attributes, HEVC bandwidth adjustments (70% of H.264), and `AUDIO`/`SUBTITLES` groups.
- **Cleanup** – Deletes the original upload and intermediate outputs on success.
- **Metadata** – Updates `videos.json` to `status: 'completed'` and emits a v`ideos-changed` event.

### 4. Queue Resilience

- **Persistence** – Jobs are stored in Redis. If the backend crashes, the queue survives.
- **Auto-Resume** – On startup, the worker re-attaches to the queue and resumes pending jobs.
- **Retry** – Failed jobs retry automatically up to 3 times with exponential backoff.
- **Cancel** – Active jobs can be cancelled via an `AbortController` that kills the FFmpeg process.
Manual Retry – Failed jobs can be retried from the UI.

### 5. Real-Time Progress
The frontend subscribes to `/api/events/:jobId` via SSE. The backend:

1. Sends the current progress immediately (recovered from Redis) when the connection opens.
2. Streams progress events as the worker emits them.
3. Closes the connection when the job completes or fails.

The video list subscribes to `/api/videos/events`, which emits a `videos-changed` event whenever metadata changes. The list refetches automatically.

### 6. Thumbnail Preview
The frontend loads the VTT file and sprite sheet. When the user hovers over the progress bar, the player calculates the corresponding time, looks up the correct tile in the VTT, and displays that portion of the sprite sheet as a preview.

### 7. Streaming & Playback
HLS files are served via Express static middleware with tuned `Cache-Control` headers:

- `.m3u8` (playlists): `no-cache, no-store, must-revalidate` (always fresh)
- `.m4s`, `.mp4`, `.vtt`, `.jpg`, `.png`: public, max-age=31536000, immutable

The frontend player (HLS.js) streams the video with adaptive bitrate and a VOD-tuned buffer configuration.

## Project Structure

```
video-streaming-service/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── ffmpeg/
│   │   │   │   ├── types.ts
│   │   │   │   ├── config.ts
│   │   │   │   ├── videoInfo.ts
│   │   │   │   ├── gpuDetector.ts
│   │   │   │   ├── thumbnailGenerator.ts
│   │   │   │   ├── hlsGenerator.ts
│   │   │   │   └── playlistGenerator.ts
│   │   │   ├── queueService.ts        # BullMQ queue + worker
│   │   │   ├── eventEmitter.ts        # Global EventEmitter for SSE
│   │   │   └── videoMetadata.ts       # Metadata persistence
│   │   ├── controllers/
│   │   │   ├── videoController.ts
│   │   │   └── queueController.ts     # SSE endpoints
│   │   ├── routes.ts
│   │   ├── config.ts
│   │   ├── index.ts
│   │   └── logger.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoList/
│   │   │   ├── VideoPlayer/
│   │   │   └── VideoUploader/
│   │   ├── hooks/
│   │   │   ├── useSSE.ts
│   │   │   ├── useActiveJobs.ts
│   │   │   └── useVideoListEvents.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env
└── README.md
```


## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a video and enqueue it for processing |
| `GET` | `/api/videos` | List all videos with metadata and status |
| `DELETE` | `/api/videos/:videoId` | Delete a video and its files |
| `GET` | `/api/video/info/:videoId` | Get info about a specific video |
| `GET` | `/api/jobs` | List jobs (with optional `states` filter) |
| `GET` | `/api/jobs/:jobId` | Get the status of a specific job |
| `DELETE` | `/api/jobs/:jobId` | Cancel a running or queued job |
| `POST` | `/api/jobs/:jobId/retry` | Retry a failed job |
| `GET` | `/api/queue/status` | Get queue counts (waiting, active, completed, failed) |
| `GET` | `/api/events/:jobId` | SSE stream for a specific job's progress |
| `GET` | `/api/videos/events` | SSE stream for video list changes |
| `GET` | `/api/gpu/info` | Get GPU availability and encoder info |
| `GET` | `/api/stream/:videoId` | Get the master playlist (used by the player) |
| `GET` | `/api/segment/:videoId/:segment` | Get a segment, playlist, or thumbnail |

## Testing

The project includes comprehensive unit and integration tests with Vitest.

### Unit Tests

- **`gpuDetector`** – GPU detection, HEVC support check, and fallback logic
- **`hlsGenerator`** – Pipeline execution, progress stages, FFmpeg arguments, and error handling
- **`playlistGenerator`** – Master playlist generation with codec variants, CODECS attributes, and bandwidth adjustments
- **`thumbnailGenerator`** – Sprite sheet creation, VTT generation, and individual thumbnail extraction
- **`videoInfo`** – Metadata extraction, framerate parsing, GOP size calculation, and duration formatting

### Integration Tests

- API endpoints (`/api/upload`, `/api/events`, `/api/videos`, `/api/stream`, etc.)
- File serving (`.m4s`, `.mp4`, `.vtt`, `.m3u8`)
- Error handling and validation
- SSE (Server-Sent Events) progress streaming

### Run Tests

```bash
cd backend
npm test
```


## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
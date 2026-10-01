# Video Streaming Service

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?)
![React](https://img.shields.io/badge/React-19-61DAFB?)
![Express](https://img.shields.io/badge/Express-5.2-000000?)
![FFmpeg](https://img.shields.io/badge/FFmpeg-8.0-007808?)
![HLS](https://img.shields.io/badge/HLS-Streaming-FF6B00?)
![DASH](https://img.shields.io/badge/DASH-Streaming-0094FF?)
![DRM](https://img.shields.io/badge/DRM-ClearKey%20%2B%20AES--128-8B5CF6?)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)
![BullMQ](https://img.shields.io/badge/BullMQ-6-FF0052?)
![MinIO](https://img.shields.io/badge/MinIO-S3--compatible-C72C48?logo=minio)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?)
![GPU Acceleration](https://img.shields.io/badge/GPU-NVENC-76B900?logo=nvidia)
![License](https://img.shields.io/badge/License-MIT-green)

A self-hosted video streaming service with GPU-accelerated transcoding, **multi-format DRM-protected delivery (HLS + DASH)**, a persistent job queue, real-time progress via Server-Sent Events, multi-audio track support, adaptive bitrate streaming, subtitle extraction, and sprite sheet thumbnails with seeking preview.

Uploads are transcoded to CMAF/fMP4 and packaged into two independent DRM-protected formats:

- **HLS** with **AES-128 whole-segment encryption** (works with HLS.js without EME)
- **DASH** with **ClearKey + EME** (works with dash.js via the browser's Encrypted Media Extensions API)

The player detects browser capabilities and picks the best format automatically, with a manual override selector.

## Index

- [Features](#features)
- [DRM Architecture](#drm-architecture)
- [CDN Architecture](#cdn-architecture)
- [Health & Monitoring](#health--monitoring)
- [GPU Acceleration (NVENC)](#gpu-acceleration-nvenc)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Third-Party Binaries](#third-party-binaries)
- [Docker Volumes](#docker-volumes)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Known Limitations & Roadmap](#known-limitations--roadmap)
- [License](#license)

## Features


### Streaming & Encoding
- **GPU Acceleration** – Uses NVIDIA NVENC for ultra-fast encoding (20x faster than CPU)
- **CMAF / fMP4** – Modern streaming format with `.m4s` segments and `init.mp4` files
- **Adaptive Bitrate Streaming** – Up to 7 quality levels (144p to 1440p) with automatic switching
- **Quality Selection** – Choose which qualities to encode (default: 480p, 720p, 1080p, 1440p) to save processing time
- **Parallel Encoding** – Up to 3 qualities encoded simultaneously with `p-limit`

### DRM / Content Protection
- **HLS with AES-128** – Whole-segment encryption via **Shaka Packager**, compatible with HLS.js (no EME required)
- **DASH with ClearKey + EME** – CENC `cbcs` encryption via **Bento4**, played back through the browser's Encrypted Media Extensions API
- **Separate License Service** – A standalone Python + FastAPI microservice backed by SQLite that stores KID/KEY pairs and serves decryption keys on demand
- **Per-Video Keys** – Each video gets a fresh 128-bit KID/KEY pair generated at processing time
- **Multi-Format Delivery** – Both formats are produced from the same intermediate MP4s, stored in separate prefixes in object storage

### Audio & Subtitles
- **Multi-Audio Support** – Handles videos with multiple audio tracks (languages, commentary, etc.)
- **Subtitles** – Extracts subtitles to WebVTT with manual parsing and language selection
- **Subtitle Wrapping** – Each `.vtt` is wrapped in a minimal `.m3u8` playlist so HLS.js can consume it as a `SUBTITLES` group

### Job Queue & Resilience
- **Persistent Job Queue** – BullMQ + Redis for transcoding jobs that survive server restarts
- **Auto-Resume on Restart** – Pending jobs resume automatically when the backend comes back up
- **Automatic Retry** – Failed jobs retry with exponential backoff (up to 3 attempts)
- **Manual Retry** – Retry failed jobs from the UI
- **Cancel Jobs** – Cancel running or queued jobs via `AbortController` (kills FFmpeg cleanly)
- **FIFO Processing** – Worker processes one video at a time (internal qualities still run in parallel)
- **Temp Cleanup** – Upload files and intermediate outputs are deleted after successful processing

### Storage & Delivery

- **SQLite Metadata Store** – Video metadata is persisted in a local SQLite database (`backend/data/videos.db`) via `better-sqlite3`, with WAL mode enabled for concurrent reads.
- **MinIO (S3-compatible)** – HLS and DASH assets are uploaded to two separate buckets after processing.
- **Nginx Edge Cache** – An Nginx CDN sits in front of MinIO and caches media segments aggressively. Playlists are served uncached; `.m4s`, `.mp4`, `.vtt`, `.jpg`, and `.png` are cached for 1 year. Cache hits are visible via the `X-Cache-Status` response header.
- **Decoupled Delivery** – The backend no longer serves media bytes; it only orchestrates processing, metadata, and job state. This mirrors the production model (CloudFront → S3) where compute and delivery are separate concerns.
- **Tuned Cache Headers** – Playlists are `no-cache, no-store, must-revalidate`; segments are `public, max-age=31536000, immutable`.


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
- **DRM Format Badge** – The player shows a live indicator of the active backend: `DASH · ClearKey` or `HLS · AES-128`

### Player
- **Dual Backend Player** – Plays HLS via HLS.js and DASH via dash.js, with automatic capability detection
- **Format Override** – Manual selector to force HLS or DASH for debugging
- **Quality / Audio / Subtitle Selectors** – Unified controls that adapt to whichever backend is active
- **Sprite Sheet Thumbnails** – 40 thumbnails (160×90) in a sprite sheet with VTT coordinates
- **Hover Preview** – Thumbnail preview on the progress bar showing the exact frame at that position
- **Buffer Optimization** – Tuned HLS.js and dash.js configs for VOD
- **Keyboard Shortcuts** – Play/pause, seek, mute, fullscreen

### Infrastructure
- **Dockerized** – Run backend, frontend, Redis, and MinIO with a single command
- **Redis Persistence** – AOF enabled for job durability across restarts
- **MinIO Persistence** – Volume-backed object storage

### Health & Observability
- **Health Check Endpoint** – `/api/health` reports the status of Redis, MinIO, SQLite, License Service, filesystem, and BullMQ queue, with per-component latency
- **Kubernetes-style Probes** – `/api/health/live` (liveness) and `/api/health/ready` (readiness) for container orchestration
- **Uptime Kuma Dashboard** – Optional containerized dashboard for visual status of the Docker services


## DRM Architecture

### Overview

```
Upload → BullMQ Worker
  │
  ├─ 1. FFmpeg: source → MP4 intermediates
  │       (video per quality + audio + thumbnails + subtitles)
  │
  ├─ 2. Generate KID/KEY (16 bytes each)
  │
  ├─ 3. Register KID/KEY with the License Service (POST /api/keys)
  │
  ├─ 4. Package DRM variants:
  │       ├─ Shaka Packager → HLS encrypted with AES-128
  │       │    (playlist references /api/license/:kid as the key URI)
  │       └─ Bento4 mp4-dash.py → DASH encrypted with ClearKey (cbcs)
  │            (MPD includes ClearKey ContentProtection + default_KID)
  │
  └─ 5. Upload both to MinIO
          ├─ hls/{videoId}/...   (AES-128)
          └─ dash/{videoId}/...  (ClearKey)
```

### HLS (AES-128 whole-segment)

- Packaged by **Shaka Packager** v3.9.1+
- Command: `--protection_scheme aes128 --clear_lead 0`
- Produces `#EXT-X-KEY:METHOD=AES-128,URI="<license>/api/license/<kid>"`
- The player fetches the raw 16-byte key via `GET /api/license/:kid` (no EME involved)
- Compatible with HLS.js across all modern browsers

### DASH (ClearKey + EME)

- Packaged by **Bento4** (`mp4-dash.py`)
- Command: `--clearkey --encryption-cenc-scheme=cbcs --clearkey-license-uri=<license>`
- Produces `<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0">` in the MPD
- The player uses **EME** (Encrypted Media Extensions) to negotiate with the browser's CDM
- The license is fetched via `POST /api/license` with the KIDs as base64url in the body
- Requires a browser with ClearKey EME support (Chrome, Edge, Firefox)

### License Service

Separate Python microservice (`license-service/`) built with FastAPI and SQLite.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/keys` | Register a KID/KEY pair (called by the worker) |
| `GET` | `/api/keys/{kid}` | Get metadata for a KID (no secret) |
| `GET` | `/api/license/{kid}` | Return the raw 16-byte key (AES-128 for HLS) |
| `POST` | `/api/license` | Return W3C ClearKey JSON (EME for DASH) |

## CDN Architecture

### Overview

The project simulates a production-grade CDN + object storage setup using two independent containers:

```
Browser
   │
   ├─ HLS:  http://localhost:8080/hls/{videoId}/master.m3u8
   └─ DASH: http://localhost:8080/dash/{videoId}/stream.mpd
              │
              ▼
       ┌──────────────┐
       │ Nginx (CDN)  │  :8080
       │ proxy_cache  │  caches segments for 1 year
       └──────┬───────┘
              │ MISS → fetch
              ▼
       ┌──────────────┐
       │ MinIO        │  :9000 (S3 API)
       │              │  :9001 (console)
       └──────────────┘
```

- Nginx acts as the edge cache (equivalent to CloudFront).
- MinIO acts as the origin object storage (equivalent to S3).
- The backend **never serves media bytes** — it only orchestrates.
- Both buckets are configured with anonymous `download` access so Nginx can read them.

### Cache rules

| File type | Cache behavior | `X-Cache-Status` |
|-----------|----------------|------------------|
| `.m3u8`, `.mpd` (playlists) | Not cached | `BYPASS` |
| `.m4s`, `.mp4`, `.ts` (segments) | Cached 1 year | `MISS` → `HIT` |
| `.vtt` (subtitles) | Cached 1 year | `MISS` → `HIT` |
| `.jpg`, `.png` (thumbnails) | Cached 1 year | `MISS` → `HIT` |

### Verifying the cache

```bash
# Playlist — always BYPASS (never cached)
curl -I http://localhost:8080/hls/video_xxx/master.m3u8
# Expect: X-Cache-Status: BYPASS

# Segment — first call MISS, second call HIT
curl -I http://localhost:8080/hls/video_xxx/video_480p/000.m4s
curl -I http://localhost:8080/hls/video_xxx/video_480p/000.m4s
# Expect: X-Cache-Status: MISS then HIT

# DASH segment — same behavior
curl -I http://localhost:8080/dash/video_xxx/video/avc1/seg-1.m4s
curl -I http://localhost:8080/dash/video_xxx/video/avc1/seg-1.m4s
```

### Making MinIO buckets public (one-time setup)

Nginx reads from MinIO **without** S3 credentials, so both buckets must allow anonymous read access:

```bash
docker exec video-streaming-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec video-streaming-minio mc anonymous set download local/hls
docker exec video-streaming-minio mc anonymous set download local/dash
```

In production, you would instead use **signed URLs** or **Origin Access Identity** to keep the bucket private. For a local learning environment, anonymous read is acceptable.

### Why this matters

This architecture mirrors how Netflix, YouTube, and Twitch deliver content:

- **Compute (transcoding)** is decoupled from **delivery (CDN)**.
- The backend can scale independently from the edge cache.
- The cache hit ratio determines how much bandwidth the origin actually serves.
- Media segments are immutable, so they can be cached for years without invalidation.

## Health & Monitoring

### Health endpoints

The backend exposes three health endpoints for different purposes:

| Endpoint | Purpose | Success | Failure |
|----------|---------|---------|---------|
| `GET /api/health` | Full status of every component | 200 | 503 |
| `GET /api/health/live` | Liveness probe (is the process alive?) | 200 | — |
| `GET /api/health/ready` | Readiness probe (can it serve traffic?) | 200 | 503 |

The `/api/health` endpoint checks in parallel:

- **Redis** — `PING` with latency measurement
- **MinIO** — `HeadBucket` on the `hls` bucket
- **SQLite** — a trivial `SELECT` to verify the DB is reachable
- **License Service** — `GET /api/health` with a 3-second timeout
- **Filesystem** — `uploads/` and `hls/` exist and are writable
- **Queue** — `getJobCounts()` from BullMQ

Response shape:

```json
{
  "status": "healthy",
  "uptimeSeconds": 3600,
  "timestamp": "2026-10-01T12:00:00.000Z",
  "components": {
    "redis":          { "status": "up", "latencyMs": 1 },
    "minio":          { "status": "up", "latencyMs": 4 },
    "database":       { "status": "up", "latencyMs": 0, "details": { "videoCount": 5 } },
    "licenseService": { "status": "up", "latencyMs": 8 },
    "filesystem":     { "status": "up", "latencyMs": 0, "details": { ... } },
    "queue":          { "status": "up", "latencyMs": 2, "details": { "waiting": 0, "active": 1, ... } }
  }
}
```

**Global status:**

- `healthy` — every component is `up`
- `degraded` — a non-critical component is `down` (e.g. License Service)
- `unhealthy` — Redis or MinIO are `down` (both are critical for job processing)

HTTP response codes: `200` for `healthy` and `degraded`, `503` for `unhealthy`.

### Uptime Kuma (optional, local development)

For a visual dashboard of service status, the project includes an optional [Uptime Kuma](https://github.com/louislam/uptime-kuma) container:

```bash
docker compose up -d uptime-kuma
```

Open http://localhost:3002 and create an admin user. Recommended monitors:

| Monitor | Type | URL / Host | Notes |
|---------|------|------------|-------|
| MinIO | HTTP(s) | `http://minio:9000/minio/health/live` | Same Docker network, resolves by container name |
| Redis | TCP Port | `redis:6379` | Same Docker network |

**Note:** Because Uptime Kuma runs inside Docker, it cannot reach services running natively on Windows (backend, frontend, License Service) via `localhost` or `host.docker.internal` due to a Docker Desktop networking limitation. Monitor only the containerized services, and use `/api/health` directly for the native ones.

## GPU Acceleration (NVENC)

This project supports GPU acceleration using NVIDIA NVENC for **local development** on Windows (with NVIDIA drivers installed).

### Codec Decision Logic

| Platform | GPU | Encoder Used |
|----------|-----|--------------|
| Windows | NVIDIA | `h264_nvenc` |
| Windows | No | `libx264` |
| Linux | Any | `libx264` |


**Note:** HEVC (`hevc_nvenc`) generation was temporarily removed during the DRM refactor. The previous pipeline generated dual-codec variants (H.264 + HEVC) for every quality. See [Known Limitations & Roadmap](#known-limitations--roadmap).

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
- FFmpeg with NVENC support (H.264)
- fluent-ffmpeg for ffprobe
- Multer for file uploads
- **p-limit** for concurrent quality processing
- **BullMQ** for the job queue
- **Redis** for queue persistence and job state
- **SQLite** (`better-sqlite3`) for video metadata
- **Server-Sent Events (SSE)** for real-time progress
- **AWS SDK v3 S3 client** for MinIO object storage

**DRM Toolchain**
- **Shaka Packager** v3.9.1+ — HLS packaging and AES-128 encryption
- **Bento4** (`mp4fragment.exe` + `mp4-dash.py`) — DASH packaging and ClearKey encryption
- **Python 3.11+** — Required at runtime for `mp4-dash.py`

**License Service**
- Python 3.11 + FastAPI + Uvicorn
- SQLAlchemy + SQLite
- Pydantic schemas

**Frontend**
- React 19 + TypeScript
- **HLS.js** for HLS playback (fMP4/CMAF)
- **dash.js** v5 for DASH playback (ClearKey + EME)
- Custom hooks for video controls, subtitles, thumbnails, SSE, job state, and player backend selection

**Infrastructure**
- Docker & Docker Compose
- Redis 7 with AOF persistence
- MinIO (S3-compatible object storage)
- Nginx as edge cache (CDN) in front of MinIO
- Nginx for serving the frontend
- Uptime Kuma for service monitoring (optional)
- Alpine Linux for lightweight images

**Testing**
- Vitest for unit and integration tests
- Supertest for API testing
- Mocked FFmpeg and external dependencies

---

## Prerequisites

- **Node.js** v20+ — for backend and frontend
- **FFmpeg** with NVENC support — optional, for GPU acceleration
- **Python 3.11+** — required at runtime for Bento4's `mp4-dash.py`
- **Docker & Docker Compose** — for Redis, MinIO, and containerized deployment
- **Shaka Packager** v3.9.1+ — for HLS packaging
- **Bento4 SDK** — for DASH packaging
- **NVIDIA GPU** — optional, for GPU-accelerated encodin

## Quick Start

### Option 1: Full Docker

1. Clone the repository:
   ```bash
   git clone https://github.com/rtagliaviaz/video-streaming-service.git
   cd video-streaming-service
   ```

2. Create the `.env` file in `backend/`:

   ```env
   NODE_ENV=production
   PORT=3001
   VIDEO_FOLDER_PATH=./uploads
   OUTPUT_FOLDER_PATH=./hls
   LOG_LEVEL=info

   REDIS_HOST=localhost
   REDIS_PORT=6379

   MINIO_ENDPOINT=http://localhost:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET=hls

   DRM_ENABLED=true
   LICENSE_SERVICE_URL=http://localhost:4000
   SHAKA_PACKAGER_PATH=./bin/packager.exe
   BENTO4_MP4DASH_SCRIPT=./utils/mp4-dash.py
   BENTO4_MP4FRAGMENT_PATH=./bin/mp4fragment.exe
   BENTO4_PYTHON_BIN=python
   ```

3. Start everything:

   ```bash
   docker-compose up -d --build
   ```

4. Open your browser at http://localhost:5173

### Option 2: Local Development

This is the recommended setup for development. Redis and MinIO run in Docker, while the backend, frontend, and License Service run locally with hot reload.

#### 2.1 — Start infrastructure (Redis + MinIO + CDN)

```bash
docker-compose up -d redis minio cdn
```

Verify all three are healthy:

```bash
docker-compose ps
```

- MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)
- CDN: http://localhost:8080

**One-time setup — make MinIO buckets public** so Nginx can read them without credentials:

```bash
docker exec video-streaming-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec video-streaming-minio mc anonymous set download local/hls
docker exec video-streaming-minio mc anonymous set download local/dash
```
**Optional: start Uptime Kuma** for a visual status dashboard:

```bash
docker-compose up -d uptime-kuma
```

Open http://localhost:3002 and configure monitors for MinIO and Redis.

#### 2.2 — Start the License Service (Python)

The DRM license server is a separate Python microservice.

```bash
cd license-service
conda create -n drm-license python=3.11 -y
conda activate drm-license
pip install -r requirements.txt
uvicorn app.main:app --reload --port 4000
```

Verify it responds at http://localhost:4000/api/health

#### 2.3 — Start the backend

In a new terminal:

```bash
cd backend
npm install
npm run dev
```

The backend listens on http://localhost:3001 and creates the SQLite database automatically at `backend/data/videos.db` on first start.

Optional: inspect the database with [DB Browser for SQLite](https://sqlitebrowser.org/) or the `sqlite3` CLI:

```bash
sqlite3 backend/data/videos.db "SELECT id, original_name, status FROM videos;"
```

#### 2.4 — Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at http://localhost:5173

#### Development flow summary

| Service | Location | Port |
|---------|----------|------|
| Redis | Docker | 6379 |
| MinIO (S3 API) | Docker | 9000 |
| MinIO (Console) | Docker | 9001 |
| CDN (Nginx) | Docker | 8080 |
| License Service | Local (Python) | 4000 |
| Backend | Local (Node) | 3001 |
| Frontend | Local (Vite) | 5173 |

**Why run the backend outside Docker?** Two reasons:

1. **GPU acceleration (NVENC):** The Docker image is Alpine-based and does not include NVIDIA drivers. Running the backend natively on Windows lets FFmpeg use `h264_nvenc` directly.
2. **Third-party binaries:** Shaka Packager and Bento4 are invoked from `backend/bin/`. Running the backend natively means you can place the Windows executables there without rebuilding the image.

For deployment scenarios where GPU acceleration is not required, the full Docker setup (Option 1) works on any Linux host with a standard CPU encoder.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Backend port | `3001` |
| `VIDEO_FOLDER_PATH` | Upload folder path | `./uploads` |
| `OUTPUT_FOLDER_PATH` | HLS/DASH output folder path | `./hls` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `MINIO_ENDPOINT` | MinIO S3 endpoint | `http://localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |
| `MINIO_BUCKET` | MinIO bucket name | `hls` |
| `DRM_ENABLED` | Enable DRM encryption | `true` |
| `LICENSE_SERVICE_URL` | URL of the License Service | `http://localhost:4000` |
| `SHAKA_PACKAGER_PATH` | Path to Shaka Packager executable | `./bin/packager.exe` |
| `BENTO4_MP4DASH_SCRIPT` | Path to Bento4's `mp4-dash.py` | `./utils/mp4-dash.py` |
| `BENTO4_MP4FRAGMENT_PATH` | Path to `mp4fragment` executable | `./bin/mp4fragment.exe` |
| `BENTO4_PYTHON_BIN` | Python interpreter for `mp4-dash.py` | `python` |
| `CDN_BASE_URL` | Public CDN URL prepended to `hlsUrl` and `dashUrl` in API responses | `http://localhost:8080` |


## Third-Party Binaries

The backend relies on two external tools that are **not committed to the repository** (they live in `backend/bin/` and `backend/utils/`, which are gitignored).

### Shaka Packager

Download from https://github.com/shaka-project/shaka-packager/releases and place `packager.exe` (Windows) or `packager` (Linux/macOS) in `backend/bin/`.

### Bento4 SDK

Download the SDK from https://www.bento4.com/downloads/ (e.g. `Bento4-SDK-1-6-0-641.x86_64-microsoft-win32.zip`).

1. Extract the SDK.
2. Copy the contents of `bin/` into `backend/bin/`:
   - `mp4fragment.exe` (required)
   - `mp4info.exe`, `mp4dump.exe`, `mp4edit.exe` (optional, useful for debug)
3. Copy the entire `utils/` folder into `backend/utils/`:
   - `mp4-dash.py` (required)
   - `mp4utils.py` (required)
   - Other `.py` helpers

**Important:** Bento4 does **not** ship a compiled `mp4dash.exe`. The dash packager is a Python script (`mp4-dash.py`) that must be invoked with a Python interpreter. Make sure `python` is on your PATH, or set `BENTO4_PYTHON_BIN` in `.env` to the full path of your Python executable.

### Verify installation

```bash
cd backend
./bin/packager.exe --version
./bin/mp4fragment.exe --version
python ./utils/mp4-dash.py --help
```

## Docker Volumes

- `./uploads` – Temporary uploaded video files (cleaned after processing)
- `./hls` – Temporary working directory for FFmpeg/Shaka/Bento4 (cleaned after upload to MinIO)
- `./minio-data` – MinIO object storage (persists all HLS and DASH assets)
- `./backend/data` – SQLite database (`videos.db`) with video metadata
- `redis-data` – Redis AOF file (persists the job queue across container restarts)
- `cdn-cache` – Nginx cache (persists cache entries across container restarts)
- `uptime-kuma-data` – Uptime Kuma monitors, history, and settings

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Right Arrow` | Seek forward 5 seconds |
| `Left Arrow` | Seek backward 5 seconds |


## How It Works

### 1. Upload & Enqueue

The user uploads one or more video files through the web interface, selecting the qualities to encode. The backend:

1. Saves the uploaded file to `uploads/`
2. Inserts metadata into the SQLite database with `status: 'queued'`
3. Adds a job to the BullMQ queue with `attempts: 3` and exponential backoff
4. Returns `jobId` and `videoId` to the client

The client opens an SSE connection to `/api/events/:jobId` for progress updates.

### 2. GPU Detection

The backend checks:

- `nvidia-smi` for NVIDIA GPU presence
- `ffmpeg -encoders` for `h264_nvenc` availability
- Platform (Windows or Linux)

Based on this, it selects the appropriate encoder strategy (see the GPU table above).

### 3. Processing Pipeline

The BullMQ worker picks up jobs one at a time (`concurrency: 1`). For each job:

1. **Cleanup** – Removes the previous output directory if the job is a retry
2. **Thumbnails** – 40 thumbnails (160×90) + sprite sheet (8×5 grid) + VTT coordinates
3. **Subtitles** – Extracted to WebVTT
4. **Audio Extraction** – All audio tracks extracted to MP4
5. **Video Transcode** – Selected qualities encoded in parallel (up to 3)
6. **DRM Key Generation** – A fresh 128-bit KID/KEY pair is generated and registered with the License Service
7. **HLS Packaging** – Shaka Packager encrypts the MP4s with AES-128
8. **DASH Packaging** – Bento4 encrypts the MP4s with ClearKey (cbcs)
9. **Upload** – Both formats are uploaded to MinIO under `hls/{videoId}/` and `dash/{videoId}/`
10. **Cleanup** – Local temp files are deleted
11. **Metadata** – SQLite database updated to `status: 'completed'` with `kid` and `formats`

### 4. Queue Resilience

- **Persistence** – Jobs are stored in Redis. If the backend crashes, the queue survives
- **Auto-Resume** – On startup, the worker re-attaches and resumes pending jobs
- **Retry** – Failed jobs retry automatically up to 3 times with exponential backoff
- **Cancel** – Active jobs can be cancelled via `AbortController` (kills FFmpeg, Shaka, Bento4)
- **Manual Retry** – Failed jobs can be retried from the UI

### 5. Real-Time Progress

The frontend subscribes to `/api/events/:jobId` via SSE. The backend:

1. Sends the current progress immediately (recovered from Redis) when the connection opens
2. Streams progress events as the worker emits them
3. Closes the connection when the job completes or fails

The video list subscribes to `/api/videos/events` and refetches when metadata changes.

### 6. Streaming & Playback

The frontend requests media **directly from the CDN** (`http://localhost:8080`), not from the backend:

- `http://localhost:8080/hls/{videoId}/master.m3u8` → served by Nginx, backed by the `hls` bucket in MinIO
- `http://localhost:8080/dash/{videoId}/stream.mpd` → served by Nginx, backed by the `dash` bucket in MinIO

Nginx caches all media segments on first fetch (`MISS`) and serves subsequent requests from cache (`HIT`). Playlists are always fetched from MinIO (`BYPASS`) so updates are picked up immediately.

Cache headers set at upload time (and forwarded by the CDN):

- `.m3u8` / `.mpd` (playlists): `no-cache, no-store, must-revalidate`
- `.m4s`, `.mp4`, `.vtt`, `.jpg`, `.png`: `public, max-age=31536000, immutable`

**Player backend selection:**

- If `dashUrl` is available **and** the browser supports ClearKey EME → **DASH via dash.js**
- Otherwise → **HLS via HLS.js**
- The user can override the choice from a dropdown in the player controls

The backend returns `hlsUrl`, `dashUrl`, and `thumbnailBaseUrl` in `/api/videos`, all already pointing at the CDN.

### 7. Thumbnail Preview

The frontend loads the VTT file and sprite sheet. When the user hovers over the progress bar, the player calculates the corresponding time, looks up the correct tile in the VTT, and displays that portion of the sprite sheet.

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
│   │   │   │   ├── transcodeToMp4.ts       # FFmpeg -> MP4 intermediates
│   │   │   │   ├── hlsEncryptor.ts         # Shaka Packager -> encrypted HLS
│   │   │   │   └── dashPackager.ts         # Bento4 -> encrypted DASH
│   │   │   ├── queueService.ts             # BullMQ queue + worker
│   │   │   ├── eventEmitter.ts             # Global EventEmitter for SSE
│   │   │   ├── db.ts                       # SQLite connection + schema
│   │   │   ├── videoRepository.ts          # SQL queries for video metadata
│   │   │   ├── videoMetadata.ts            # VideoMetadata type definition
│   │   │   ├── drmService.ts               # KID/KEY generation + License Service client
│   │   │   └── s3Service.ts                # MinIO upload, get, delete
│   │   ├── controllers/
│   │   │   ├── videoController.ts
│   │   │   ├── healthController.ts        # Health check endpoints
│   │   │   └── queueController.ts          # SSE endpoints
│   │   ├── routes.ts
│   │   ├── config.ts
│   │   ├── index.ts
│   │   └── logger.ts
│   ├── data/                               # SQLite database (gitignored)
│   │   └── videos.db
│   ├── bin/                                # Shaka Packager + Bento4 binaries (gitignored)
│   ├── utils/                              # Bento4 Python scripts (gitignored)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoList/
│   │   │   ├── VideoPlayer/
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useHLS.ts
│   │   │   │   │   ├── useDASH.ts
│   │   │   │   │   └── usePlayerBackend.ts
│   │   │   │   └── ...
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
├── license-service/                        # Python + FastAPI DRM license server
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── routes.py
│   └── requirements.txt
├── nginx/
│   └── cdn.conf                            # Edge cache config (proxy_cache -> MinIO)
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a video and enqueue it for processing |
| `GET` | `/api/videos` | List all videos with metadata, status, `hlsUrl`, `dashUrl`, `thumbnailBaseUrl`, and `kid` |
| `DELETE` | `/api/videos/:videoId` | Delete a video and its HLS + DASH assets |
| `GET` | `/api/video/info/:videoId` | Get info about a specific video |
| `GET` | `/api/jobs` | List jobs (with optional `states` filter) |
| `GET` | `/api/jobs/:jobId` | Get the status of a specific job |
| `DELETE` | `/api/jobs/:jobId` | Cancel a running or queued job |
| `POST` | `/api/jobs/:jobId/retry` | Retry a failed job |
| `GET` | `/api/queue/status` | Get queue counts (waiting, active, completed, failed) |
| `GET` | `/api/events/:jobId` | SSE stream for a specific job's progress |
| `GET` | `/api/videos/events` | SSE stream for video list changes |
| `GET` | `/api/gpu/info` | Get GPU availability and encoder info |
| `GET` | `/api/health` | Full status of every component |
| `GET` | `/api/health/live` | Liveness probe |
| `GET` | `/api/health/ready` | Readiness probe |

**CDN (Nginx, port 8080):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/hls/:videoId/*` | HLS playlists and segments (cached) |
| `GET` | `/dash/:videoId/*` | DASH manifest and segments (cached) |

**License Service (Python, port 4000):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/keys` | Register a new KID/KEY pair |
| `GET` | `/api/keys/:kid` | Get metadata for a KID |
| `GET` | `/api/license/:kid` | Raw 16-byte key (AES-128 for HLS) |
| `POST` | `/api/license` | W3C ClearKey JSON (EME for DASH) |

## Testing

The project includes unit and integration tests with Vitest.

### Unit Tests

- **`gpuDetector`** – GPU detection and fallback logic
- **`transcodeToMp4`** – Transcode pipeline execution and progress stages
- **`hlsEncryptor`** – Shaka Packager integration and playlist generation
- **`dashPackager`** – Bento4 integration and manifest generation
- **`thumbnailGenerator`** – Sprite sheet creation, VTT generation, individual thumbnail extraction
- **`videoInfo`** – Metadata extraction, framerate parsing, GOP size calculation

### Integration Tests

- API endpoints (`/api/upload`, `/api/events`, `/api/videos`, etc.)
- File serving (`.m4s`, `.mp4`, `.vtt`, `.m3u8`)
- Error handling and validation
- SSE progress streaming

### Run Tests

```bash
cd backend
npm test
```

## Known Limitations & Roadmap

### HEVC support (parked during DRM refactor)

An earlier version of the pipeline generated **dual-codec variants** (H.264 + HEVC) for every quality level, using `hevc_nvenc` on Windows with NVIDIA GPUs. This let clients pick HEVC for ~30% bandwidth savings when supported (Safari natively, Chrome/Edge via extension).

During the DRM refactor (moving from a single FFmpeg pass to `transcodeToMp4` + `hlsEncryptor` + `dashPackager`), HEVC generation was temporarily removed to reduce surface area while validating the ClearKey/AES-128 flows. The legacy implementation is preserved in the git history for reference.


## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
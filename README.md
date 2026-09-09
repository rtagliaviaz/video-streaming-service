# Video Streaming Service

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?)
![React](https://img.shields.io/badge/React-19-61DAFB?)
![Express](https://img.shields.io/badge/Express-5.2-000000?)
![FFmpeg](https://img.shields.io/badge/FFmpeg-8.0-007808?)
![HLS](https://img.shields.io/badge/HLS-Streaming-FF6B00?)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?)
![GPU Acceleration](https://img.shields.io/badge/GPU-NVENC-76B900?logo=nvidia)
![License](https://img.shields.io/badge/License-MIT-green)

A self-hosted HLS (HTTP Live Streaming) video streaming service with GPU acceleration, multi-audio track support, adaptive bitrate streaming, subtitle extraction, and sprite sheet thumbnails with seeking preview.

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
- [Testing](#testing)
- [License](#license)

## Features

- **GPU Acceleration** – Uses NVIDIA NVENC for ultra-fast encoding (20x faster than CPU)
- **Dual Codec Support** – Generates both H.264 (universal) and HEVC (GPU-accelerated on Windows) with automatic client-side selection
- **CMAF / fMP4** – Modern streaming format with `.m4s` segments and `init.mp4` files
- **Quality Selection** – Choose which qualities to encode (default: 480p, 720p, 1080p, 1440p) to save processing time
- **Multi-Audio Support** – Handles videos with multiple audio tracks (languages, commentary, etc.)
- **Subtitles** – Extracts subtitles to WebVTT with manual parsing and language selection
- **Adaptive Bitrate Streaming** – 7 quality levels (144p to 1440p) with automatic switching
- **Custom Video Player** – Built with HLS.js, with quality, audio, subtitle, and speed selectors
- **Real-time Progress** – Server-Sent Events (SSE) for live upload and processing updates
- **Sprite Sheet Thumbnails** – 40 thumbnails per video (160x90) organized in a sprite sheet with VTT coordinates for smooth seeking preview on the progress bar
- **Thumbnail Preview on Hover** – When hovering over the progress bar, a thumbnail preview appears showing the exact frame at that position
- **Parallel Processing** – Up to 3 qualities encoded simultaneously with `p-limit`
- **Bulk Delete** – Select and delete multiple videos at once
- **Dockerized** – Run the entire stack with a single command

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

**Frontend**
- React 19 + TypeScript
- HLS.js for video playback (native fMP4/CMAF support)
- Custom hooks for video controls, subtitles, and thumbnails

**Infrastructure**
- Docker & Docker Compose
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
```

3. Start the services:

```bash
docker-compose up -d --build
```

4. Open your browser at http://localhost:5173

### Option 2: Local Development

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

## Docker Volumes

- `./uploads` – Temporary uploaded video files (automatically cleaned after processing)
- `./hls` – Generated HLS files (playlists, segments, thumbnails, subtitles)

## Keyboard Shortcuts

| Key| Action |
|----------|-------------|
| `Space` / `K` | Play / Pause |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Right Arrow` | Seek forward 5 seconds |
| `Left Arrow` | Seek backward 5 seconds |


## How It Works

### 1. Upload
The user uploads a video file through the web interface. The frontend allows selecting which qualities to encode (default: 480p, 720p, 1080p, 1440p) to save processing time.

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
The backend processes the video using FFmpeg:

- **Thumbnails** – 40 thumbnail images (160×90) distributed evenly across the video duration, plus a sprite sheet (8×5 grid) and VTT file with coordinates.
- **Audio Extraction** – Extracts all audio tracks and creates separate HLS playlists using fMP4 (`.m4s` + `init_audio_*.mp4`).
- **Subtitle Extraction** – Extracts subtitles to WebVTT.
- **Quality Encoding** – Processes selected qualities in parallel (up to 3 at a time):
  - For each quality, generates H.264 version (always)
  - If HEVC is available, generates HEVC version in parallel
  - Uses fMP4 format (`.m4s` segments + `init_*.mp4` files)
- **Master Playlist** – Generates `index.m3u8` containing all codec variants with:
  - `CODECS` attribute (`avc1.640028` for H.264, `hvc1` for HEVC)
  - Adjusted `BANDWIDTH` for HEVC (70% of H.264 equivalent)
  - `AUDIO` and `SUBTITLES` groups when available

### 4. Thumbnail Preview
The frontend loads the VTT file and sprite sheet. When the user hovers over the progress bar, the player calculates the corresponding time, looks up the correct tile in the VTT, and displays that portion of the sprite sheet as a preview.

### 5. Streaming & Playback
The HLS playlist is served via Express. The frontend player (HLS.js) streams the video with adaptive bitrate, automatically selecting the best codec and quality variant based on the client's capabilities.

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
│   │   │   ├── queueService.ts    
│   │   │   └── videoMetadata.ts    
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── config.ts
│   │   ├── index.ts
│   │   └── logger.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ 
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env
└── README.md
```

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
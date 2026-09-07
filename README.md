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

A self-hosted HLS (HTTP Live Streaming) video streaming service with GPU acceleration, multi-audio track support, adaptive bitrate streaming, and subtitle extraction.

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
- [License](#license)

## Features

- **GPU Acceleration** – Uses NVIDIA NVENC for ultra-fast encoding (20x faster than CPU)
- **Multi-Audio Support** – Handles videos with multiple audio tracks (languages, commentary, etc.)
- **Subtitles** – Extracts subtitles to WebVTT with manual parsing and language selection
- **Adaptive Bitrate Streaming** – 7 quality levels (144p to 1440p) with automatic switching
- **Custom Video Player** – Built with HLS.js, with quality, audio, subtitle, and speed selectors
- **Real-time Progress** – Server-Sent Events (SSE) for live upload and processing updates
- **Thumbnails** – Automatic thumbnail generation for video preview
- **Bulk Delete** – Select and delete multiple videos at once
- **Dockerized** – Run the entire stack with a single command

## GPU Acceleration (NVENC)

This project supports GPU acceleration using NVIDIA NVENC for **local development** on Windows (with NVIDIA drivers installed).

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
- FFmpeg with NVENC support
- fluent-ffmpeg for ffprobe
- Multer for file uploads

**Frontend**
- React 19 + TypeScript
- HLS.js for video playback
- Vite for fast builds

**Infrastructure**
- Docker & Docker Compose
- Nginx for serving frontend
- Alpine Linux for lightweight images

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

1. **Upload** – Upload a video file through the web interface.

2. **Processing** – The backend processes the video using FFmpeg:

- Detects GPU availability (NVENC)
- Extracts all audio tracks and creates separate HLS playlists
- Extracts subtitles to WebVTT
- Generates 7 quality levels (144p to 1440p) with dynamic GOP size (2 seconds)
- Creates thumbnails

3. **Streaming** – The HLS playlist is served via Express.

4. **Playback** – The frontend player (HLS.js) streams the video with adaptive bitrate.

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
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoPlayer/    
│   │   │   ├── VideoList/       
│   │   │   └── VideoUploader/         
│   │   ├── hooks/
│   │   │   ├── useHLS.ts
│   │   │   ├── useVideoControls.ts
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── useVideoInfo.ts
│   │   │   ├── useSubtitles.ts
│   │   │   ├── useFullscreen.ts
│   │   │   └── useSSE.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .env
└── README.md
```

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
import React, { useRef, useEffect, useState } from 'react';
import { useThumbnailVTT } from '../hooks/useThumbnailVTT';
import type { ThumbnailTile } from '../hooks/useThumbnailVTT';

interface ThumbnailPreviewProps {
  videoId: string;
  duration: number;
  containerWidth: number;
  mouseX: number;
  visible: boolean;
}

export const ThumbnailPreview: React.FC<ThumbnailPreviewProps> = ({
  videoId,
  duration,
  containerWidth,
  mouseX,
  visible,
}) => {
  const { tiles, spriteUrl, loading } = useThumbnailVTT(videoId);
  const [previewTime, setPreviewTime] = useState(0);
  const [tile, setTile] = useState<ThumbnailTile | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !duration || !tiles.length) {
      setTile(null);
      return;
    }

    const ratio = Math.max(0, Math.min(1, mouseX / containerWidth));
    let time = ratio * duration;
    // redondear a 3 decimales para evitar errores de precisión
    time = Math.round(time * 1000) / 1000;
    if (time > duration) time = duration;

    setPreviewTime(time);

    let found = tiles.find(t => time >= t.start && time <= t.end);

    if (!found && tiles.length > 0) {
      const last = tiles[tiles.length - 1];
      if (time >= last.start) {
        found = last;
      }
    }

    setTile(found || null);
  }, [mouseX, containerWidth, duration, visible, tiles]);

  if (!visible || !tile || loading || !spriteUrl) return null;

  const previewWidth = 160;
  const previewHeight = 90;
  const leftPos = mouseX - previewWidth / 2;
  const clampedLeft = Math.max(0, Math.min(containerWidth - previewWidth, leftPos));

  return (
    <div
      ref={previewRef}
      style={{
        position: 'absolute',
        bottom: '60px',
        left: clampedLeft,
        width: previewWidth,
        height: previewHeight,
        pointerEvents: 'none',
        zIndex: 10,
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        backgroundImage: `url(${spriteUrl})`,
        backgroundPosition: `-${tile.x}px -${tile.y}px`,
        backgroundSize: 'auto',
        imageRendering: 'pixelated',
        border: '2px solid rgba(255,255,255,0.2)',
        transition: 'opacity 0.1s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.75)',
          color: 'white',
          fontSize: '13px',
          textAlign: 'center',
          padding: '4px 0',
          fontWeight: '500',
          letterSpacing: '0.5px',
          backdropFilter: 'blur(4px)',
        }}
      >
        {formatTime(previewTime)}
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
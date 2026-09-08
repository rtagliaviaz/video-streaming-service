import { useEffect, useState } from 'react';

export interface ThumbnailTile {
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useThumbnailVTT(videoId: string | null, duration: number = 0) {
  const [tiles, setTiles] = useState<ThumbnailTile[]>([]);
  const [spriteUrl, setSpriteUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!videoId) {
      setTiles([]);
      setSpriteUrl('');
      return;
    }

    const fetchVTT = async () => {
      setLoading(true);
      try {
        const vttUrl = `/api/thumbnails/${videoId}/thumbnails.vtt`;
        const response = await fetch(vttUrl);
        if (!response.ok) throw new Error('VTT not found');
        const vttText = await response.text();
        const parsed = parseVTT(vttText);
        if (parsed.length > 0) {
          setTiles(parsed);
          setSpriteUrl(`/api/thumbnails/${videoId}/sprite.jpg`);
        } else {
          useFallback(duration);
        }
      } catch (error) {
        console.warn('Error loading thumbnails VTT, using fallback:', error);
        useFallback(duration);
      } finally {
        setLoading(false);
      }
    };

    const useFallback = (dur: number) => {
      if (dur <= 0) {
        setTiles([]);
        setSpriteUrl('');
        return;
      }
      const num = 40;
      const cols = 8;
      const interval = dur / num;
      const width = 160;
      const height = 90;
      const fallbackTiles: ThumbnailTile[] = [];
      for (let i = 0; i < num; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        fallbackTiles.push({
          start: i * interval,
          end: (i + 1) * interval,
          x: col * (width + 4) + 4,
          y: row * (height + 4) + 4,
          width,
          height,
        });
      }
      setTiles(fallbackTiles);
      setSpriteUrl(`/api/thumbnails/${videoId}/sprite.jpg`);
    };

    fetchVTT();
  }, [videoId, duration]);

  return { tiles, spriteUrl, loading };
}

function parseVTT(vttText: string): ThumbnailTile[] {
  const lines = vttText.split('\n');
  const tiles: ThumbnailTile[] = [];
  let current: Partial<ThumbnailTile> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [start, end] = line.split('-->').map(t => t.trim());
      current.start = parseTime(start);
      current.end = parseTime(end);
    } else if (line.includes('#xywh=')) {
      const coords = line.split('#xywh=')[1];
      const [x, y, width, height] = coords.split(',').map(Number);
      current.x = x;
      current.y = y;
      current.width = width;
      current.height = height;
      if (
        current.start !== undefined && current.end !== undefined &&
        current.x !== undefined && current.y !== undefined &&
        current.width !== undefined && current.height !== undefined
      ) {
        tiles.push(current as ThumbnailTile);
        current = {};
      }
    }
  }
  return tiles;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number);
    return h * 3600 + m * 60 + s;
  }
  return 0;
}
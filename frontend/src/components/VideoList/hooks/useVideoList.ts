import { useState, useEffect, useCallback } from 'react';
import { videoApi } from '../../../services/api';
import { useVideoListEvents } from './useVideoListEvents';
import type { Video } from '../types';

export const useVideoList = () => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const loadVideos = useCallback(async () => {
        try {
            const response = await videoApi.getVideos();
            setVideos(response.data.videos || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching videos:', err);
            setError('Failed to load videos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadVideos();
    }, [loadVideos]);

    useVideoListEvents(loadVideos);

    const deleteVideo = useCallback(async (videoId: string): Promise<boolean> => {
        setDeleting(videoId);
        try {
            await videoApi.deleteVideo(videoId);
            setVideos((prev) => prev.filter((v) => v.id !== videoId));
            setSelectedVideos((prev) => {
                const next = new Set(prev);
                next.delete(videoId);
                return next;
            });
            return true;
        } catch (err) {
            console.error('Error deleting video:', err);
            return false;
        } finally {
            setDeleting(null);
        }
    }, []);

    const toggleSelectVideo = useCallback((videoId: string) => {
        setSelectedVideos((prev) => {
            const next = new Set(prev);
            if (next.has(videoId)) next.delete(videoId);
            else next.add(videoId);
            return next;
        });
    }, []);

    const selectAllVideos = useCallback(() => {
        setSelectedVideos(new Set(videos.filter((v) => v.exists).map((v) => v.id)));
    }, [videos]);

    const deselectAllVideos = useCallback(() => {
        setSelectedVideos(new Set());
    }, []);

    const deleteSelectedVideos = useCallback(async () => {
        if (selectedVideos.size === 0) return;
        if (!confirm(`Delete ${selectedVideos.size} video(s)?`)) return;

        setIsBulkDeleting(true);
        try {
            const ids = Array.from(selectedVideos);
            await Promise.all(ids.map((id) => videoApi.deleteVideo(id)));
            setVideos((prev) => prev.filter((v) => !selectedVideos.has(v.id)));
            setSelectedVideos(new Set());
        } catch (err) {
            console.error('Error bulk deleting:', err);
        } finally {
            setIsBulkDeleting(false);
        }
    }, [selectedVideos]);

    return {
        videos,
        loading,
        error,
        deleting,
        selectedVideos,
        isBulkDeleting,
        loadVideos,
        deleteVideo,
        toggleSelectVideo,
        selectAllVideos,
        deselectAllVideos,
        deleteSelectedVideos,
    };
};
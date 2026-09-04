import { useState, useEffect, useCallback } from 'react';
import { videoApi } from '../../../services/api';
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
            setVideos(response.data.videos);
            setError(null);
        } catch (err) {
            console.error('Failed to load videos:', err);
            setError('Failed to load videos');
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteVideo = useCallback(async (videoId: string) => {
        setDeleting(videoId);
        try {
            await videoApi.deleteVideo(videoId);
            await loadVideos();
            return true;
        } catch (err) {
            console.error('Failed to delete video:', err);
            setError('Failed to delete video');
            return false;
        } finally {
            setDeleting(null);
        }
    }, [loadVideos]);

    const toggleSelectVideo = useCallback((videoId: string) => {
        setSelectedVideos((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(videoId)) {
                newSet.delete(videoId);
            } else {
                newSet.add(videoId);
            }
            return newSet;
        });
    }, []);

    const selectAllVideos = useCallback(() => {
        const allIds = videos.filter(v => v.exists).map(v => v.id);
        setSelectedVideos(new Set(allIds));
    }, [videos]);

    const deselectAllVideos = useCallback(() => {
        setSelectedVideos(new Set());
    }, []);

    const deleteSelectedVideos = useCallback(async () => {
        if (selectedVideos.size === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${selectedVideos.size} video(s)?`)) {
            return;
        }

        setIsBulkDeleting(true);
        try {
            const deletePromises = Array.from(selectedVideos).map(id => videoApi.deleteVideo(id));
            await Promise.all(deletePromises);
            await loadVideos();
            setSelectedVideos(new Set());
        } catch (err) {
            console.error('Failed to delete videos:', err);
            setError('Failed to delete some videos');
        } finally {
            setIsBulkDeleting(false);
        }
    }, [selectedVideos, loadVideos]);

    useEffect(() => {
        loadVideos();
        const interval = setInterval(loadVideos, 15000);
        return () => clearInterval(interval);
    }, [loadVideos]);

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
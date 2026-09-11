import { useState, useEffect, useCallback } from 'react';
import { videoApi } from '../../../services/api';

export interface ActiveJob {
    jobId: string;
    videoId: string;
    originalName: string;
    fileSize: number;
}

export const useActiveJobs = () => {
    const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActiveJobs = useCallback(async () => {
        try {
            const response = await videoApi.getVideos();
            const videos: any[] = response.data.videos || [];
            const active: ActiveJob[] = videos
                .filter(
                    (v) =>
                        (v.status === 'processing' || v.status === 'queued') && v.jobId
                )
                .map((v) => ({
                    jobId: v.jobId,
                    videoId: v.id,
                    originalName: v.originalName,
                    fileSize: v.size || 0,
                }));
            setActiveJobs(active);
        } catch (err) {
            console.error('Error fetching active jobs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveJobs();
    }, [fetchActiveJobs]);

    useEffect(() => {
        let es: EventSource | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let attempts = 0;
        const maxAttempts = 10;

        const connect = () => {
            es = new EventSource('/api/videos/events');

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'changed') {
                        fetchActiveJobs();
                    }
                } catch {
                    // ignorar keep-alives
                }
                attempts = 0;
            };

            es.onerror = () => {
                es?.close();
                if (attempts < maxAttempts) {
                    attempts++;
                    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
                    reconnectTimer = setTimeout(connect, delay);
                }
            };
        };

        connect();

        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            es?.close();
        };
    }, [fetchActiveJobs]);

    return { activeJobs, loading };
};
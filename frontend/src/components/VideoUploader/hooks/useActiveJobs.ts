import { useState, useEffect } from 'react';
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

    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const response = await videoApi.getVideos();
                if (!isMounted) return;
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
                if (isMounted) setLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    return { activeJobs, loading };
};
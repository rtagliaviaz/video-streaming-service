import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api',
});

export const videoApi = {
    uploadVideo: async (
        file: File,
        onProgress?: (percent: number) => void,
        qualities?: string[]
    ): Promise<{ data: { jobId: string; videoId: string; originalName: string; qualities?: string[] } }> => {
        const formData = new FormData();
        formData.append('video', file);
        if (qualities && qualities.length > 0) {
            formData.append('qualities', JSON.stringify(qualities));
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 202) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve({ data: response });
                    } catch (e) {
                        reject(new Error('Invalid response'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.error || 'Upload failed'));
                    } catch (e) {
                        reject(new Error('Upload failed'));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
    },

    getJobStatus: (jobId: string) => api.get(`/jobs/${jobId}`),

    listJobs: (states?: string[], limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (states && states.length > 0) {
            params.append('states', states.join(','));
        }
        if (limit) params.append('limit', String(limit));
        if (offset) params.append('offset', String(offset));
        return api.get(`/jobs?${params.toString()}`);
    },

    cancelJob: (jobId: string) => api.delete(`/jobs/${jobId}`),
    retryJob: (jobId: string) => api.post(`/jobs/${jobId}/retry`),

    getGPUInfo: () => api.get('/gpu/info'),
    getQueueStatus: () => api.get('/queue/status'),
    getVideos: () => api.get('/videos'),
    getVideoInfo: (videoId: string) => api.get(`/video/info/${videoId}`),
    deleteVideo: (videoId: string) => api.delete(`/videos/${videoId}`),
    cleanupTemp: () => api.delete('/videos/cleanup'),
};
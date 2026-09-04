import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api',
});

export const videoApi = {
    uploadVideo: (file: File, onProgress: (percent: number) => void) => {
        const formData = new FormData();
        formData.append('video', file);
        return api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percent);
                }
            },
        });
    },
    getGPUInfo: () => api.get('/gpu/info'),
    getQueueStatus: () => api.get('/queue/status'),
    getVideos: () => api.get('/videos'),
    getVideoInfo: (videoId: string) => api.get(`/video/info/${videoId}`),
    deleteVideo: (videoId: string) => api.delete(`/videos/${videoId}`),
    cleanupTemp: () => api.delete('/videos/cleanup'),
};
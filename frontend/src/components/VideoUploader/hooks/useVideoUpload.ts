import { useState, useEffect, useCallback } from 'react';
import { videoApi } from '../../../services/api';
import { useSSE } from '../../../hooks/useSSE';
import { DEFAULT_QUALITIES } from '../../../constants';
import type { QualityOption } from '../../../constants';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

interface UseVideoUploadProps {
    onUploadSuccess: (videoId: string) => void;
}

export const useVideoUpload = ({ onUploadSuccess }: UseVideoUploadProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [selectedQualities, setSelectedQualities] = useState<QualityOption[]>(DEFAULT_QUALITIES as QualityOption[]);

    const { progressInfo, isComplete: sseComplete, error: sseError } = useSSE(jobId);

    useEffect(() => {
        if (sseComplete && videoId) {
            console.log('✅ Video processed and ready to play');
            setIsProcessing(false);
            setIsComplete(true);
            onUploadSuccess(videoId);
        }
    }, [sseComplete, videoId, onUploadSuccess]);

    useEffect(() => {
        if (isComplete) {
            const timer = setTimeout(() => {
                setJobId(null);
                setVideoId(null);
                setIsComplete(false);
                setFile(null);
                setUploadProgress(0);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [isComplete]);

    useEffect(() => {
        if (sseError) {
            setError(`Processing error: ${sseError}`);
            setIsProcessing(false);
            setIsComplete(false);
        }
    }, [sseError]);

    const validateFile = useCallback((file: File): boolean => {
        if (file.size > MAX_FILE_SIZE) {
            setError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB limit`);
            return false;
        }
        return true;
    }, []);

    const selectFile = useCallback((selectedFile: File) => {
        if (isComplete) return;
        if (validateFile(selectedFile)) {
            setFile(selectedFile);
            setError(null);
        }
    }, [validateFile, isComplete]);

    const toggleQuality = useCallback((quality: QualityOption) => {
        if (uploading || isProcessing || isComplete) return;
        setSelectedQualities(prev =>
            prev.includes(quality)
                ? prev.filter(q => q !== quality)
                : [...prev, quality]
        );
    }, [uploading, isProcessing, isComplete]);

    const uploadFile = useCallback(async () => {
        if (!file || isComplete) return;

        setUploading(true);
        setUploadProgress(0);
        setError(null);
        setIsProcessing(false);
        setIsComplete(false);

        try {
            const response = await videoApi.uploadVideo(
                file,
                (percent) => setUploadProgress(percent),
                selectedQualities as string[] // cast a string[] para evitar error de tipos
            );

            const { videoId: vid, jobId: jid } = response.data;
            setVideoId(vid);
            setJobId(jid);
            setIsProcessing(true);
            console.log(`📹 Video ID: ${vid}, Job ID: ${jid}, Qualities: ${selectedQualities.join(', ')}`);

            setUploading(false);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || err.message || 'Failed to upload video');
            setUploading(false);
        }
    }, [file, isComplete, selectedQualities]);

    const cancelUpload = useCallback(() => {
        if (isComplete) return;
        setFile(null);
        setError(null);
        setUploadProgress(0);
    }, [isComplete]);

    const formatFileSize = useCallback((bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }, []);

    return {
        file,
        uploading,
        uploadProgress,
        jobId,
        videoId,
        error,
        isProcessing,
        processingProgress: progressInfo?.percent || 0,
        progressInfo,
        isComplete,
        selectedQualities,
        selectFile,
        uploadFile,
        cancelUpload,
        toggleQuality,
        formatFileSize,
        validateFile,
    };
};
export interface VideoUploaderProps {
    onUploadSuccess: (videoId: string) => void;
}

export interface UploadState {
    file: File | null;
    uploading: boolean;
    uploadProgress: number;
    jobId: string | null;
    videoId: string | null;
    error: string | null;
    isProcessing: boolean;
}
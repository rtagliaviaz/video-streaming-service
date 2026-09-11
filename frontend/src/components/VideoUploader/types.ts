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

export interface UploadItem {
    id: string;
    originalName: string;
    fileSize: number;
    file: File | null;
    uploading: boolean;
    uploadProgress: number;
    jobId: string | null;
    videoId: string | null;
    error: string | null;
    progress: number;
    stage: string;
    details: any;
    isComplete: boolean;
}
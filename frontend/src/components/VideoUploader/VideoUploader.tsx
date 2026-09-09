import React, { useState } from 'react';
import type { VideoUploaderProps } from './types';
import { useVideoUpload } from './hooks/useVideoUpload';
import { FileDropZone } from './components/FileDropZone';
import { ProgressBar } from './components/ProgressBar';
import { UploadStatus } from './components/UploadStatus';
import { ProcessingDetails } from './components/ProcessingDetails';
import { QUALITY_OPTIONS } from '../../constants';

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);

    const {
        file,
        uploading,
        uploadProgress,
        error,
        isProcessing,
        progressInfo,
        isComplete,
        selectedQualities,
        selectFile,
        uploadFile,
        cancelUpload,
        toggleQuality,
        formatFileSize,
    } = useVideoUpload({ onUploadSuccess });

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            selectFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            selectFile(e.target.files[0]);
        }
    };

    const isDisabled = uploading || isProcessing || isComplete;

    return (
        <div>
            <FileDropZone
                isDragging={isDragging}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFileChange={handleFileChange}
                disabled={isDisabled}
                file={file}
                formatFileSize={formatFileSize}
                uploading={uploading}
                isProcessing={isProcessing}
            />

            <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                    🎯 Select qualities to encode:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {QUALITY_OPTIONS.map((quality) => (
                        <label
                            key={quality}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.85rem',
                                opacity: isDisabled ? 0.5 : 1,
                                cursor: isDisabled ? 'default' : 'pointer',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedQualities.includes(quality)}
                                onChange={() => toggleQuality(quality)}
                                disabled={isDisabled}
                            />
                            {quality}
                        </label>
                    ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                    Selected: {selectedQualities.join(', ') || 'None (will use all)'}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                    className="primary"
                    onClick={uploadFile}
                    disabled={!file || isDisabled}
                >
                    {uploading ? '⏳ Uploading...' :
                     isProcessing ? '⚙️ Processing...' :
                     isComplete ? '✅ Done' :
                     '🚀 Upload'}
                </button>

                {file && !uploading && !isProcessing && !isComplete && (
                    <button onClick={cancelUpload}>❌ Cancel</button>
                )}
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
                <ProgressBar
                    label="Upload"
                    icon="📤"
                    progress={uploadProgress}
                    color="upload"
                />
            )}

            {isProcessing && (
                <ProcessingDetails progressInfo={progressInfo} />
            )}

            <UploadStatus
                isComplete={isComplete}
                error={error}
                onRetry={() => {
                    window.location.reload();
                }}
            />
        </div>
    );
};
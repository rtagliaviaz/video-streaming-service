import React, { useState } from 'react';
import type { VideoUploaderProps } from './types';
import { useVideoUpload } from './hooks/useVideoUpload';
import { FileDropZone } from './components/FileDropZone';
import { UploadStatus } from './components/UploadStatus';
import { UploadList } from './components/UploadList';
import { QUALITY_OPTIONS } from '../../constants';

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);

    const {
        items,
        error,
        isComplete,
        successMessage,
        selectedQualities,
        addFiles,
        removeItem,
        uploadAll,
        cancelUpload,
        toggleQuality,
        formatFileSize,
        hasPending,
        isUploading,
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
            e.target.value = '';
        }
    };

    const isDisabled = isUploading;

    return (
        <div>
            <FileDropZone
                isDragging={isDragging}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFileChange={handleFileChange}
                disabled={isDisabled}
                fileCount={items.length}
                formatFileSize={formatFileSize}
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
                    onClick={uploadAll}
                    disabled={!hasPending || isDisabled}
                >
                    {isUploading ? '⏳ Uploading...' : `🚀 Upload ${items.filter(i => !i.jobId).length || ''}`}
                </button>

                {items.some((it) => !it.jobId && !it.uploading) && (
                    <button onClick={cancelUpload}>❌ Clear</button>
                )}
            </div>

            <UploadList
                items={items}
                formatFileSize={formatFileSize}
                onRemove={removeItem}
            />

            <UploadStatus
                isComplete={isComplete}
                successMessage={successMessage}
                error={error}
                onRetry={() => {
                    window.location.reload();
                }}
            />
        </div>
    );
};
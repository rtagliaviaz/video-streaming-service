import React from 'react';

interface FileDropZoneProps {
    isDragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
    file: File | null;
    formatFileSize: (bytes: number) => string;
    uploading: boolean;
    isProcessing: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileChange,
    disabled,
    file,
    formatFileSize,
    uploading,
    isProcessing,
}) => {
    return (
        <div 
            className={`card upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <h3>📤 Upload Video</h3>
            
            {file && !uploading && !isProcessing && (
                <div className="file-info">
                    <span className="name">📄 {file.name}</span>
                    <span className="size">{formatFileSize(file.size)}</span>
                </div>
            )}

            <input
                type="file"
                accept="video/*"
                onChange={onFileChange}
                disabled={disabled}
                style={{ marginBottom: '0.75rem' }}
            />
        </div>
    );
};
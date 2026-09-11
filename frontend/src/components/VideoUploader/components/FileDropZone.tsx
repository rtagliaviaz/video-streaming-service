import React from 'react';

interface FileDropZoneProps {
    isDragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
    fileCount: number;
    formatFileSize: (bytes: number) => string;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileChange,
    disabled,
    fileCount,
}) => {
    return (
        <div
            className={`card upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <h3>📤 Upload Videos</h3>

            {fileCount > 0 && (
                <div className="file-info">
                    <span className="name">
                        📄 {fileCount} file{fileCount > 1 ? 's' : ''} selected
                    </span>
                </div>
            )}

            <input
                type="file"
                accept="video/*"
                multiple
                onChange={onFileChange}
                disabled={disabled}
                style={{ marginBottom: '0.75rem' }}
            />
        </div>
    );
};
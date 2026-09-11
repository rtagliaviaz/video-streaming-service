import React from 'react';
import type { UploadItem } from '../types';
import { UploadItemRow } from './UploadItemRow';

interface UploadListProps {
    items: UploadItem[];
    formatFileSize: (bytes: number) => string;
    onRemove: (id: string) => void;
}

export const UploadList: React.FC<UploadListProps> = ({
    items,
    formatFileSize,
    onRemove,
}) => {
    if (items.length === 0) return null;

    return (
        <div className="card" style={{ marginTop: '1rem' }}>
            <div
                className="upload-list-container"
                style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '0.5rem',
                }}
            >
                {items.map((item) => (
                    <UploadItemRow
                        key={item.id}
                        item={item}
                        formatFileSize={formatFileSize}
                        onRemove={onRemove}
                    />
                ))}
            </div>

            <style>{`
                .upload-list-container {
                    scrollbar-width: thin;
                    scrollbar-color: var(--border) var(--code-bg);
                }
                .upload-list-container::-webkit-scrollbar {
                    width: 6px;
                }
                .upload-list-container::-webkit-scrollbar-track {
                    background: var(--code-bg);
                    border-radius: 9999px;
                }
                .upload-list-container::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 9999px;
                }
                .upload-list-container::-webkit-scrollbar-thumb:hover {
                    background: var(--accent);
                }

                @media (max-width: 640px) {
                    .upload-list-container {
                        max-height: 180px;
                        padding-right: 0.25rem;
                    }
                }
                @media (max-width: 400px) {
                    .upload-list-container {
                        max-height: 160px;
                        padding-right: 0;
                    }
                }
            `}</style>
        </div>
    );
};
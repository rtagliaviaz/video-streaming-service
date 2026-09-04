import React from 'react';
import type { VideoListProps } from './types';
import { useVideoList } from './hooks/useVideoList';
import { VideoItem } from './components/VideoItem';
import { VideoListEmpty } from './components/VideoListEmpty';

export const VideoList: React.FC<VideoListProps> = ({ onSelectVideo, selectedVideoId }) => {
    const {
        videos,
        loading,
        error,
        deleting,
        selectedVideos,
        isBulkDeleting,
        loadVideos,
        deleteVideo,
        toggleSelectVideo,
        selectAllVideos,
        deselectAllVideos,
        deleteSelectedVideos,
    } = useVideoList();

    const handleDelete = async (videoId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videos.find(v => v.id === videoId);
        if (!confirm(`Are you sure you want to delete "${video?.originalName || videoId}"?`)) {
            return;
        }
        const success = await deleteVideo(videoId);
        if (success && selectedVideoId === videoId) {
            onSelectVideo('');
        }
    };

    const handlePlayVideo = (videoId: string) => {
        onSelectVideo(videoId);
    };

    const handleToggleSelect = (videoId: string) => {
        toggleSelectVideo(videoId);
    };

    if (loading && videos.length === 0) {
        return (
            <div className="card">
                <h3>📹 Processed Videos</h3>
                <p style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.6 }}>
                    ⏳ Loading videos...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <h3>📹 Processed Videos</h3>
                <p style={{ color: 'var(--error)' }}>❌ {error}</p>
            </div>
        );
    }

    const selectedCount = selectedVideos.size;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>📹 Videos ({videos.length})</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {videos.some(v => v.exists) && (
                        <>
                            <button 
                                onClick={selectAllVideos}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                                disabled={isBulkDeleting}
                            >
                                Select All
                            </button>
                            <button 
                                onClick={deselectAllVideos}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                                disabled={isBulkDeleting || selectedCount === 0}
                            >
                                Deselect
                            </button>
                            {selectedCount > 0 && (
                                <button 
                                    onClick={deleteSelectedVideos}
                                    style={{ 
                                        fontSize: '0.75rem', 
                                        padding: '0.2rem 0.6rem',
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                    }}
                                    disabled={isBulkDeleting}
                                >
                                    🗑️ Delete {selectedCount}
                                </button>
                            )}
                        </>
                    )}
                    <button 
                        onClick={loadVideos} 
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                        disabled={loading}
                    >
                        {loading ? '⏳' : '🔄 Refresh'}
                    </button>
                </div>
            </div>

            {videos.length === 0 ? (
                <VideoListEmpty />
            ) : (
                <div className="video-list">
                    {videos.map((video) => (
                        <VideoItem
                            key={video.id}
                            video={video}
                            isSelected={selectedVideos.has(video.id)}
                            isDeleting={deleting === video.id || isBulkDeleting}
                            onToggleSelect={handleToggleSelect}  
                            onPlayVideo={handlePlayVideo}        
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
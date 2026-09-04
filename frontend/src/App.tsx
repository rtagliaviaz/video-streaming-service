import React, { useState, useCallback } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoList } from './components/VideoList';

function App() {
    const [videoId, setVideoId] = useState<string | null>(null);

    const handleUploadSuccess = useCallback((newVideoId: string) => {
        setVideoId(newVideoId);
        console.log('✅ Video uploaded and processing, ID:', newVideoId);
    }, []);

    const handleSelectVideo = useCallback((selectedVideoId: string) => {
        setVideoId(selectedVideoId);
        console.log('🎬 Selected video:', selectedVideoId);
    }, []);

    return (
        <div id="root">
            <header style={{ marginBottom: '2rem' }}>
                <h1>🎬 Local Streaming Service</h1>
                <p style={{ color: 'var(--text)', opacity: 0.7 }}>
                    Upload, process, and stream videos locally with HLS
                </p>
            </header>

            <div className="app-grid">
                <div>
                    <VideoUploader onUploadSuccess={handleUploadSuccess} />
                </div>
                <div>
                    <VideoList 
                        onSelectVideo={handleSelectVideo}
                        selectedVideoId={videoId}
                    />
                </div>
            </div>

            <hr style={{ 
                border: 'none', 
                borderTop: '1px solid var(--border)', 
                margin: '2rem 0' 
            }} />

            <div>
                <h2>▶️ Player</h2>
                <VideoPlayer videoId={videoId} />
            </div>

            <div style={{ 
                marginTop: '1rem', 
                fontSize: '0.8rem', 
                color: 'var(--text)', 
                opacity: 0.6,
                textAlign: 'center'
            }}>
                {videoId ? (
                    <p>🎯 Streaming: <code style={{ fontSize: '0.75rem' }}>/api/stream/{videoId}</code></p>
                ) : (
                    <p>💡 Upload a video or select one from the list to start streaming</p>
                )}
            </div>
        </div>
    );
}

export default App;
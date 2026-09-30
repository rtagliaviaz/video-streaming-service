import { useState, useCallback } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoList } from './components/VideoList';
import type { Video } from './components/VideoList/types';

function App() {
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

    const handleUploadSuccess = useCallback((newVideoId: string) => {
        console.log('✅ Video uploaded and processing, ID:', newVideoId);
        // no auto select
    }, []);

    const handleSelectVideo = useCallback((video: Video) => {
        setSelectedVideo(video);
        console.log('🎬 Selected video:', video.id, '| HLS:', video.hlsUrl, '| DASH:', video.dashUrl);
    }, []);

    return (
        <div id="root">
            <header style={{ marginBottom: '2rem' }}>
                <h1>🎬 Local Streaming Service</h1>
                <p style={{ color: 'var(--text)', opacity: 0.7 }}>
                    Upload, process, and stream videos locally with HLS + DASH
                </p>
            </header>

            <div className="app-grid">
                <div>
                    <VideoUploader onUploadSuccess={handleUploadSuccess} />
                </div>
                <div>
                    <VideoList
                        onSelectVideo={handleSelectVideo}
                        selectedVideoId={selectedVideo?.id}
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
                <VideoPlayer
                    videoId={selectedVideo?.id ?? null}
                    hlsUrl={selectedVideo?.hlsUrl ?? null}
                    dashUrl={selectedVideo?.dashUrl ?? null}
                    kid={selectedVideo?.kid ?? null}
                />
            </div>

            <div style={{
                marginTop: '1rem',
                fontSize: '0.8rem',
                color: 'var(--text)',
                opacity: 0.6,
                textAlign: 'center'
            }}>
                {selectedVideo ? (
                    <>
                        <p>
                            🎯 Streaming: <code style={{ fontSize: '0.75rem' }}>{selectedVideo.id}</code>
                            {selectedVideo.kid && (
                                <> · KID: <code style={{ fontSize: '0.75rem' }}>{selectedVideo.kid.slice(0, 8)}…</code></>
                            )}
                        </p>
                        <p>
                            HLS: {selectedVideo.hlsUrl ? '✅' : '❌'} ·
                            DASH: {selectedVideo.dashUrl ? '✅' : '❌'}
                        </p>
                    </>
                ) : (
                    <p>💡 Upload a video or select one from the list to start streaming</p>
                )}
            </div>
        </div>
    );
}

export default App;
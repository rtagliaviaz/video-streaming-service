import React from 'react';
import type { ProgressInfo } from '../../../types';

interface ProcessingDetailsProps {
  progressInfo: ProgressInfo | null;
}

export const ProcessingDetails: React.FC<ProcessingDetailsProps> = ({ progressInfo }) => {
  if (!progressInfo) return null;

  const { percent, stage, details } = progressInfo;

  const getStageLabel = () => {
    switch (stage) {
      case 'idle': return 'Initializing...';
      case 'audio': return 'Extracting audio tracks';
      case 'subtitles': return 'Extracting subtitles';
      case 'thumbnails': return 'Generating thumbnails';
      case 'qualities': return 'Processing qualities';
      case 'done': return 'Completed!';
      default: return 'Processing...';
    }
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div className="progress-bar">
        <div className="fill processing" style={{ width: `${percent}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <span>⚙️ {getStageLabel()}</span>
        <span>{percent}%</span>
      </div>

      {details && (
        <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', opacity: 0.9 }}>
          {details.totalAudioTracks !== undefined && (
            <div>🎵 Audio: {details.audioTracksExtracted || 0} / {details.totalAudioTracks}</div>
          )}

          {details.totalSubtitles !== undefined && (
            <div>📝 Subtitles: {details.subtitlesExtracted || 0} / {details.totalSubtitles}</div>
          )}

          {details.totalThumbnails !== undefined && (
            <div>
              🖼️ Thumbnails: {details.thumbnailsGenerated || 0} / {details.totalThumbnails}
              {details.spriteGenerated && <span> ✅ Sprite generated</span>}
            </div>
          )}

          {details.totalQualities !== undefined && (
            <div>
              📹 Qualities: {details.completedQualities || 0} / {details.totalQualities}
              {details.currentQuality && <span> (Processing {details.currentQuality})</span>}
            </div>
          )}

          {details.qualitiesStatus && details.qualitiesStatus.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
              {details.qualitiesStatus.map((q, i) => (
                <span
                  key={i}
                  style={{
                    background: q.status === 'completed' ? '#1a3a2a' :
                               q.status === 'processing' ? '#1a2a3a' :
                               q.status === 'failed' ? '#3a1a1a' : '#2a2a3e',
                    color: q.status === 'completed' ? '#6fcf97' :
                           q.status === 'processing' ? '#7c9bdb' :
                           q.status === 'failed' ? '#e74c3c' : '#808090',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                  }}
                >
                  {q.status === 'completed' ? '✅' :
                   q.status === 'processing' ? '⏳' :
                   q.status === 'failed' ? '❌' : '⬜'} {q.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

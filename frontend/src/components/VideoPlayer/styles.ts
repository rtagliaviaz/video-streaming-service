export const playerStyles = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .video-container:hover .controls-overlay {
        opacity: 1 !important;
        pointer-events: auto !important;
    }
    
    input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
    }
    
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #7c3aed;
        cursor: pointer;
    }
    
    input[type="range"]::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: none;
        background: #7c3aed;
        cursor: pointer;
    }

    /* ✅ ✅ ✅ FULLSCREEN CORREGIDO */
    .video-container:fullscreen {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 9999 !important;
    }
    
    .video-container:fullscreen video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        object-fit: contain !important;
        aspect-ratio: auto !important;
        display: block !important;
    }
    
    .video-container:fullscreen .controls-overlay {
        width: 100% !important;
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
    }

    /* WebKit */
    .video-container:-webkit-full-screen {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 9999 !important;
    }
    
    .video-container:-webkit-full-screen video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        object-fit: contain !important;
        aspect-ratio: auto !important;
        display: block !important;
    }

    /* Mozilla */
    .video-container:-moz-full-screen {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 9999 !important;
    }
    
    .video-container:-moz-full-screen video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        object-fit: contain !important;
        aspect-ratio: auto !important;
        display: block !important;
    }

    /* MS Edge */
    .video-container:-ms-fullscreen {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 9999 !important;
    }
    
    .video-container:-ms-fullscreen video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        object-fit: contain !important;
        aspect-ratio: auto !important;
        display: block !important;
    }
`;

export const containerStyles = {
    container: {
        position: 'relative' as const,
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        background: '#000',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        cursor: 'default' as const,
        display: 'flex',      
        alignItems: 'center',      
        justifyContent: 'center', 
        aspectRatio: '16/9',
    },
    video: {
        width: '100%',
        height: '100%',
        display: 'block' as const,
        background: '#000',
        cursor: 'pointer' as const,
        objectFit: 'contain' as const,
    },
    emptyState: {
        position: 'relative' as const,
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        background: '#1a1a2e',
        borderRadius: 'var(--radius)',
        overflow: 'hidden' as const,
        boxShadow: 'var(--shadow-lg)',
        aspectRatio: '16/9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    emptyIcon: {
        fontSize: '3rem',
        opacity: 0.3,
    },
    emptyTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: '1.1rem',
        margin: 0,
    },
    emptySubtitle: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.85rem',
        margin: 0,
    },
};
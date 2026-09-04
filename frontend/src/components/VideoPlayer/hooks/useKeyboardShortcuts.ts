import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
    togglePlay: () => void;
    toggleFullscreen: () => void;
    toggleMute: () => void;
    videoRef: React.RefObject<HTMLVideoElement>;
}

export const useKeyboardShortcuts = ({
    togglePlay,
    toggleFullscreen,
    toggleMute,
    videoRef,
}: UseKeyboardShortcutsProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'ArrowRight':
                    if (videoRef.current) {
                        videoRef.current.currentTime += 5;
                    }
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) {
                        videoRef.current.currentTime -= 5;
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, toggleFullscreen, toggleMute, videoRef]);
};
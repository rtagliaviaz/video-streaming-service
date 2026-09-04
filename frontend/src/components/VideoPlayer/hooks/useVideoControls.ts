import { useState, useRef, useCallback } from 'react';

export const useVideoControls = (videoRef: React.RefObject<HTMLVideoElement>) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [bufferedProgress, setBufferedProgress] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<number | null>(null);

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const updateBufferedProgress = useCallback(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const progress = (bufferedEnd / video.duration) * 100;
            setBufferedProgress(Math.min(progress, 100));
        }
    }, [videoRef]);

    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
    }, [videoRef]);

    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
    }, [videoRef]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return;
        const val = parseFloat(e.target.value);
        videoRef.current.volume = val;
        setVolume(val);
        setIsMuted(val === 0);
    }, [videoRef]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return;
        const val = parseFloat(e.target.value);
        videoRef.current.currentTime = val;
        setCurrentTime(val);
    }, [videoRef]);


    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            window.clearTimeout(controlsTimeoutRef.current);
        }
        if (!isPlaying) {
            controlsTimeoutRef.current = window.setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    }, [isPlaying]);

    const handlePlay = useCallback(() => {
        setIsPlaying(true);
        setShowControls(false);
        if (controlsTimeoutRef.current) {
            window.clearTimeout(controlsTimeoutRef.current);
        }
    }, []);

    const handlePause = useCallback(() => {
        setIsPlaying(false);
        setShowControls(true);
    }, []);

    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            updateBufferedProgress();
        }
    }, [videoRef, updateBufferedProgress]);

    const handleLoadedMetadata = useCallback(() => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            updateBufferedProgress();
        }
    }, [videoRef, updateBufferedProgress]);

    const handleVolumeChangeEvent = useCallback(() => {
        if (videoRef.current) {
            setVolume(videoRef.current.volume);
            setIsMuted(videoRef.current.muted);
        }
    }, [videoRef]);

    const handleProgress = useCallback(() => {
        updateBufferedProgress();
    }, [updateBufferedProgress]);

    const cleanup = useCallback(() => {
        if (controlsTimeoutRef.current) {
            window.clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }
    }, []);

    return {

        isPlaying,
        isMuted,
        volume,
        currentTime,
        duration,
        bufferedProgress,
        showControls,

        togglePlay,
        toggleMute,
        handleVolumeChange,
        handleSeek,
        showControlsTemporarily,
        setShowControls,

        handlePlay,
        handlePause,
        handleTimeUpdate,
        handleLoadedMetadata,
        handleVolumeChangeEvent,
        handleProgress,

        formatTime,
        cleanup,
    };
};
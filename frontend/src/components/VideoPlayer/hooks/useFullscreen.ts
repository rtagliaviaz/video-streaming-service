import { useState, useCallback, useEffect } from 'react';

export const useFullscreen = (containerRef: React.RefObject<HTMLDivElement>) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if ((container as any).webkitRequestFullscreen) {
                (container as any).webkitRequestFullscreen();
            } else if ((container as any).mozRequestFullScreen) {
                (container as any).mozRequestFullScreen();
            } else if ((container as any).msRequestFullscreen) {
                (container as any).msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
            } else if ((document as any).mozCancelFullScreen) {
                (document as any).mozCancelFullScreen();
            } else if ((document as any).msExitFullscreen) {
                (document as any).msExitFullscreen();
            }
        }
    }, [containerRef]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = !!document.fullscreenElement;
            setIsFullscreen(isFs);
            
            if (!containerRef.current) return;
            const container = containerRef.current;
            const video = container.querySelector('video');
            
           // base no-fullscreen
            container.style.position = 'relative';
            container.style.width = '100%';
            container.style.maxWidth = '900px';
            container.style.margin = '0 auto';
            container.style.background = '#000';
            container.style.borderRadius = 'var(--radius)';
            container.style.overflow = 'hidden';
            container.style.boxShadow = 'var(--shadow-lg)';
            container.style.cursor = 'default';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.aspectRatio = '16/9';
            
            if (video) {
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.display = 'block';
                video.style.background = '#000';
                video.style.cursor = 'pointer';
                video.style.objectFit = 'contain';
            }
            
            if (isFs) {
                container.style.maxWidth = '100vw';
                container.style.maxHeight = '100vh';
                container.style.width = '100vw';
                container.style.height = '100vh';
                container.style.borderRadius = '0';
                container.style.margin = '0';
                container.style.padding = '0';
                container.style.position = 'fixed';
                container.style.top = '0';
                container.style.left = '0';
                container.style.zIndex = '9999';
                container.style.aspectRatio = 'auto';
                
                if (video) {
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.maxWidth = '100vw';
                    video.style.maxHeight = '100vh';
                    video.style.objectFit = 'contain';
                }
            } else {
                // saliendo de fullscreen
                container.style.maxWidth = '900px';
                container.style.maxHeight = '';
                container.style.width = '100%';
                container.style.height = '';
                container.style.borderRadius = 'var(--radius)';
                container.style.margin = '0 auto';
                container.style.padding = '';
                container.style.position = 'relative';
                container.style.top = '';
                container.style.left = '';
                container.style.zIndex = '';
                container.style.aspectRatio = '16/9';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                
                if (video) {
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.maxWidth = '';
                    video.style.maxHeight = '';
                    video.style.objectFit = 'contain';
                    video.style.position = '';
                    video.style.top = '';
                    video.style.left = '';
                }
            }
        };
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, [containerRef]);

    return { isFullscreen, toggleFullscreen };
};
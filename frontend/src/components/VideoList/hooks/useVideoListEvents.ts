import { useEffect, useRef } from 'react';

export const useVideoListEvents = (onChange: () => void) => {
    const callbackRef = useRef(onChange);
    callbackRef.current = onChange;

    useEffect(() => {
        let es: EventSource | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let attempts = 0;
        const maxAttempts = 10;

        const connect = () => {
            es = new EventSource('/api/videos/events');

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'changed') {
                        callbackRef.current();
                    }
                } catch {
                    // ignore parse errors (keep-alive comments)
                }
                attempts = 0;
            };

            es.onerror = () => {
                es?.close();
                if (attempts < maxAttempts) {
                    attempts++;
                    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
                    reconnectTimer = setTimeout(connect, delay);
                }
            };
        };

        connect();

        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            es?.close();
        };
    }, []);
};
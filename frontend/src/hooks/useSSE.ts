import { useState, useEffect, useRef } from 'react';

export const useSSE = (jobId: string | null) => {
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (!jobId) {
            setProgress(0);
            setIsComplete(false);
            setError(null);
            return;
        }

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const connect = () => {
            console.log(`Connecting to SSE for job: ${jobId}`);
            const eventSource = new EventSource(`http://localhost:3001/api/events?jobId=${jobId}`);
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('SSE data:', data);

                    if (data.progress !== undefined) {
                        setProgress(data.progress);
                    }
                    if (data.done) {
                        setIsComplete(true);
                        setProgress(100);
                        eventSource.close();
                        eventSourceRef.current = null;
                    }
                    if (data.error) {
                        setError(data.error);
                        eventSource.close();
                        eventSourceRef.current = null;
                    }
                    reconnectAttempts = 0;
                } catch (err) {
                    console.error('SSE parse error:', err);
                }
            };

            eventSource.onerror = () => {
                console.log('SSE connection error');
                eventSource.close();
                eventSourceRef.current = null;
                
                if (!isComplete && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
                    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                    
                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                        reconnectTimeoutRef.current = null;
                    }
                    reconnectTimeoutRef.current = window.setTimeout(connect, delay);
                } else if (reconnectAttempts >= maxReconnectAttempts) {
                    setError('Connection failed after multiple attempts');
                }
            };

            return eventSource;
        };

        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [jobId, isComplete]);

    return { progress, isComplete, error };
};
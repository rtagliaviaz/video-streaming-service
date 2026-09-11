import { useState, useEffect, useRef } from 'react';

interface SSEProgress {
    jobId: string;
    progress: number;
    stage: string;
    details?: any;
}

export const useSSE = (jobId: string | null) => {
    const [progress, setProgress] = useState<number>(0);
    const [stage, setStage] = useState<string>('idle');
    const [details, setDetails] = useState<any>({});
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 10;

    useEffect(() => {
        // Resetear todo el estado al cambiar de jobId o al pasar a null
        setIsComplete(false);
        setError(null);
        setProgress(0);
        setStage('idle');
        setDetails({});
        reconnectAttempts.current = 0;

        if (!jobId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        let isMounted = true;
        let completed = false;

        const connectSSE = () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const eventSource = new EventSource(`/api/events/${jobId}`);
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const data: SSEProgress & { error?: string } = JSON.parse(event.data);
                    if (data.error) {
                        setError(data.error);
                        eventSource.close();
                        return;
                    }
                    setProgress(data.progress ?? 0);
                    setStage(data.stage || 'idle');
                    setDetails(data.details || {});
                    setLoading(false);
                    reconnectAttempts.current = 0;

                    if (data.stage === 'done') {
                        completed = true;
                        setIsComplete(true);
                        eventSource.close();
                    }
                    if (data.stage === 'failed') {
                        completed = true;
                        setError(data.details?.error || 'Job failed');
                        eventSource.close();
                    }
                } catch (parseError) {
                    console.error('Error parsing SSE data:', parseError);
                }
            };

            eventSource.onerror = () => {
                if (!isMounted || completed) return;
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++;
                    const delay = Math.min(
                        1000 * Math.pow(2, reconnectAttempts.current - 1),
                        10000
                    );
                    console.log(
                        `SSE reconnect attempt ${reconnectAttempts.current} in ${delay}ms`
                    );
                    eventSource.close();
                    setTimeout(() => {
                        if (isMounted && !completed) {
                            connectSSE();
                        }
                    }, delay);
                } else {
                    setError('Lost connection to server');
                    eventSource.close();
                }
            };
        };

        connectSSE();

        return () => {
            isMounted = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [jobId]);

    return { progress, stage, details, isComplete, error, loading };
};
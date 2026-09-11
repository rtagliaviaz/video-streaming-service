import { useState, useEffect, useCallback, useRef } from 'react';
import { videoApi } from '../../../services/api';
import { DEFAULT_QUALITIES } from '../../../constants';
import type { QualityOption } from '../../../constants';
import type { UploadItem } from '../types';
import { useActiveJobs } from './useActiveJobs';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

interface UseVideoUploadProps {
    onUploadSuccess: (videoId: string) => void;
}

let localIdCounter = 0;
const nextLocalId = () => `u_${Date.now()}_${localIdCounter++}`;

export const useVideoUpload = ({ onUploadSuccess }: UseVideoUploadProps) => {
    const [items, setItems] = useState<UploadItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [selectedQualities, setSelectedQualities] = useState<QualityOption[]>(
        DEFAULT_QUALITIES as QualityOption[]
    );

    const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
    const notifiedRef = useRef<Set<string>>(new Set());

    const { activeJobs } = useActiveJobs();

    // recuperar jobs activos al montar y cada vez que cambian
    useEffect(() => {
        if (activeJobs.length === 0) return;
        setItems((prev) => {
            const next = [...prev];
            for (const j of activeJobs) {
                const idx = next.findIndex((it) => it.jobId === j.jobId);
                if (idx === -1) {
                    next.push({
                        id: nextLocalId(),
                        originalName: j.originalName,
                        fileSize: j.fileSize,
                        file: null,
                        uploading: false,
                        uploadProgress: 100,
                        jobId: j.jobId,
                        videoId: j.videoId,
                        error: null,
                        progress: 0,
                        stage: 'idle',
                        details: {},
                        isComplete: false,
                    });
                } else if (next[idx].error || next[idx].isComplete) {
                    next[idx] = {
                        ...next[idx],
                        id: nextLocalId(),
                        error: null,
                        progress: 0,
                        stage: 'idle',
                        details: {},
                        isComplete: false,
                        uploading: false,
                        uploadProgress: 100,
                    };
                }
            }
            return next;
        });
    }, [activeJobs]);

    // escuchar evento 'job-retried' del VideoItem 
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const { jobId, videoId, originalName, fileSize } = detail;

            // Cerrar EventSource previo si existe
            const oldEs = eventSourcesRef.current.get(jobId);
            if (oldEs) {
                oldEs.close();
                eventSourcesRef.current.delete(jobId);
            }

            setItems((prev) => {
                const existing = prev.find((it) => it.jobId === jobId);
                if (existing) {
                    return prev.map((it) =>
                        it.jobId === jobId
                            ? {
                                  ...it,
                                  id: nextLocalId(),
                                  error: null,
                                  progress: 0,
                                  stage: 'idle',
                                  details: {},
                                  isComplete: false,
                                  uploading: false,
                                  uploadProgress: 100,
                              }
                            : it
                    );
                }
                return [
                    ...prev,
                    {
                        id: nextLocalId(),
                        originalName,
                        fileSize,
                        file: null,
                        uploading: false,
                        uploadProgress: 100,
                        jobId,
                        videoId,
                        error: null,
                        progress: 0,
                        stage: 'idle',
                        details: {},
                        isComplete: false,
                    },
                ];
            });
        };

        window.addEventListener('job-retried', handler);
        return () => window.removeEventListener('job-retried', handler);
    }, []);

    // SSE por cada jobId para visualizar el proyecto de cada job
    useEffect(() => {
        const currentJobIds = new Set(
            items.map((i) => i.jobId).filter(Boolean) as string[]
        );

        eventSourcesRef.current.forEach((es, jobId) => {
            if (!currentJobIds.has(jobId)) {
                es.close();
                eventSourcesRef.current.delete(jobId);
            }
        });

        items.forEach((item) => {
            if (!item.jobId) return;
            if (item.isComplete) return;
            if (eventSourcesRef.current.has(item.jobId)) return;

            const jobId = item.jobId;
            const es = new EventSource(`/api/events/${jobId}`);
            eventSourcesRef.current.set(jobId, es);

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) return;

                    setItems((prev) =>
                        prev.map((it) => {
                            if (it.jobId !== jobId) return it;
                            const isDone = data.stage === 'done';
                            const isFailed = data.stage === 'failed';
                            return {
                                ...it,
                                progress: data.progress ?? it.progress,
                                stage: data.stage || it.stage,
                                details: data.details || it.details,
                                isComplete: isDone ? true : it.isComplete,
                                error: isFailed
                                    ? data.details?.error || 'Job failed'
                                    : it.error,
                            };
                        })
                    );

                    if (data.stage === 'done' || data.stage === 'failed') {
                        es.close();
                        eventSourcesRef.current.delete(jobId);
                    }
                } catch {
                    // ignorar
                }
            };

            es.onerror = () => {
                // reintenta automáticamente
            };
        });
    }, [items]);

    useEffect(() => {
        return () => {
            eventSourcesRef.current.forEach((es) => es.close());
            eventSourcesRef.current.clear();
        };
    }, []);

    useEffect(() => {
        items.forEach((item) => {
            if (
                item.isComplete &&
                item.videoId &&
                !notifiedRef.current.has(item.videoId)
            ) {
                notifiedRef.current.add(item.videoId);
                onUploadSuccess(item.videoId);
            }
        });
    }, [items, onUploadSuccess]);

    const isComplete = items.length > 0 && items.every((it) => it.isComplete);

    useEffect(() => {
        if (isComplete && !successMessage) {
            setSuccessMessage('✅ All videos processed successfully');
        }
    }, [isComplete, successMessage]);

    const validateFile = useCallback((f: File): boolean => {
        if (f.size > MAX_FILE_SIZE) {
            setError(
                `File "${f.name}" exceeds ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB limit`
            );
            return false;
        }
        return true;
    }, []);

    const addFiles = useCallback(
        (files: File[]) => {
            const valid: UploadItem[] = [];
            for (const f of files) {
                if (!validateFile(f)) continue;
                valid.push({
                    id: nextLocalId(),
                    originalName: f.name,
                    fileSize: f.size,
                    file: f,
                    uploading: false,
                    uploadProgress: 0,
                    jobId: null,
                    videoId: null,
                    error: null,
                    progress: 0,
                    stage: 'idle',
                    details: {},
                    isComplete: false,
                });
            }
            if (valid.length > 0) {
                setItems((prev) => [...prev, ...valid]);
                setError(null);
                setSuccessMessage(null);
            }
        },
        [validateFile]
    );

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const item = prev.find((it) => it.id === id);
            if (item?.jobId) {
                const es = eventSourcesRef.current.get(item.jobId);
                if (es) {
                    es.close();
                    eventSourcesRef.current.delete(item.jobId);
                }
            }
            return prev.filter((it) => it.id !== id);
        });
    }, []);

    const toggleQuality = useCallback((quality: QualityOption) => {
        setSelectedQualities((prev) =>
            prev.includes(quality)
                ? prev.filter((q) => q !== quality)
                : [...prev, quality]
        );
    }, []);

    const uploadAll = useCallback(async () => {
        const pending = items.filter(
            (it) => !it.jobId && !it.uploading && it.file
        );
        if (pending.length === 0) return;

        setError(null);
        setSuccessMessage(null);

        setItems((prev) =>
            prev.map((it) =>
                pending.some((p) => p.id === it.id)
                    ? { ...it, uploading: true, uploadProgress: 0, error: null }
                    : it
            )
        );

        for (const item of pending) {
            if (!item.file) continue;
            (async () => {
                try {
                    const response = await videoApi.uploadVideo(
                        item.file!,
                        (percent) => {
                            setItems((prev) =>
                                prev.map((it) =>
                                    it.id === item.id
                                        ? { ...it, uploadProgress: percent }
                                        : it
                                )
                            );
                        },
                        selectedQualities as string[]
                    );

                    const { videoId, jobId } = response.data;
                    setItems((prev) =>
                        prev.map((it) =>
                            it.id === item.id
                                ? {
                                      ...it,
                                      uploading: false,
                                      uploadProgress: 100,
                                      jobId,
                                      videoId,
                                  }
                                : it
                        )
                    );
                } catch (err: any) {
                    const msg =
                        err.response?.data?.error ||
                        err.message ||
                        'Failed to upload video';
                    setItems((prev) =>
                        prev.map((it) =>
                            it.id === item.id
                                ? { ...it, uploading: false, error: msg }
                                : it
                        )
                    );
                }
            })();
        }
    }, [items, selectedQualities]);

    const cancelUpload = useCallback(() => {
        setItems((prev) => prev.filter((it) => it.uploading || it.jobId));
        setError(null);
        setSuccessMessage(null);
    }, []);

    const formatFileSize = useCallback((bytes: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024)
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }, []);

    return {
        items,
        error,
        isComplete,
        successMessage,
        selectedQualities,
        addFiles,
        removeItem,
        uploadAll,
        cancelUpload,
        toggleQuality,
        formatFileSize,
        hasPending: items.some((it) => !it.jobId && !it.uploading && it.file),
        isUploading: items.some((it) => it.uploading),
    };
};
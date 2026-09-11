import { EventEmitter } from 'events';

export const progressEmitter = new EventEmitter();

// evento: 'progress' con datos { jobId, progress, stage, details }
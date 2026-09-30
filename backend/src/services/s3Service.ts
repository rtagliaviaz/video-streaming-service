import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    CreateBucketCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../logger';

const agent = new https.Agent({
    maxSockets: 10,
    keepAlive: false,
    timeout: 30000,
});

const s3 = new S3Client({
    endpoint: config.minio.endpoint,
    region: 'us-east-1',
    credentials: {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
        httpsAgent: agent,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        socketAcquisitionWarningTimeout: 30000,
    }),
    maxAttempts: 2,
});

const HLS_BUCKET = config.minio.bucket;
const DASH_BUCKET = 'dash';

function getFileMeta(filePath: string): { contentType: string; cacheControl: string } {
    const lower = filePath.toLowerCase();

    if (lower.endsWith('.m3u8')) {
        return {
            contentType: 'application/vnd.apple.mpegurl',
            cacheControl: 'no-cache, no-store, must-revalidate',
        };
    }
    if (lower.endsWith('.mpd')) {
        return {
            contentType: 'application/dash+xml',
            cacheControl: 'no-cache, no-store, must-revalidate',
        };
    }
    if (lower.endsWith('.m4s') || lower.endsWith('.mp4')) {
        return { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' };
    }
    if (lower.endsWith('.ts')) {
        return { contentType: 'video/mp2t', cacheControl: 'public, max-age=31536000, immutable' };
    }
    if (lower.endsWith('.vtt')) {
        return { contentType: 'text/vtt', cacheControl: 'public, max-age=31536000, immutable' };
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        return { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' };
    }
    if (lower.endsWith('.png')) {
        return { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' };
    }
    return { contentType: 'application/octet-stream', cacheControl: 'public, max-age=31536000, immutable' };
}

function getAllFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...getAllFiles(full));
        else files.push(full);
    }
    return files;
}

// ---- Bucket management ----

export async function ensureBucket(bucket: string = HLS_BUCKET): Promise<void> {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        logger.info(`[s3] Bucket "${bucket}" already exists`);
    } catch (err: any) {
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
            await s3.send(new CreateBucketCommand({ Bucket: bucket }));
            logger.info(`[s3] Bucket "${bucket}" created`);
        } else {
            throw err;
        }
    }
}

export async function ensureAllBuckets(): Promise<void> {
    await ensureBucket(HLS_BUCKET);
    await ensureBucket(DASH_BUCKET);
}

// ---- Upload ----

/**
 * Upload a local directory to MinIO, preserving the directory structure.
 * Limits concurrency to 20 simultaneous uploads to avoid exhausting the socket pool.
 */
export async function uploadDirectory(
    localDir: string,
    s3Prefix: string,
    bucket: string = HLS_BUCKET,
): Promise<number> {
    if (!fs.existsSync(localDir)) {
        throw new Error(`Local directory not found: ${localDir}`);
    }

    const files = getAllFiles(localDir);
    logger.info(`[s3] Uploading ${files.length} files to s3://${bucket}/${s3Prefix}/`);

    const CONCURRENCY = 20;
    let uploaded = 0;
    let cursor = 0;

    async function worker() {
        while (true) {
            const index = cursor++;
            if (index >= files.length) return;

            const file = files[index];
            const relative = path.relative(localDir, file).replace(/\\/g, '/');
            const key = `${s3Prefix}/${relative}`;
            const { contentType, cacheControl } = getFileMeta(file);

            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: fs.createReadStream(file),
                ContentType: contentType,
                CacheControl: cacheControl,
            }));
            uploaded++;
        }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker());
    await Promise.all(workers);

    logger.info(`[s3] Uploaded ${uploaded} files to s3://${bucket}/${s3Prefix}/`);
    return uploaded;
}

/**
 * Upload the HLS output directory to the HLS bucket.
 * Files are stored under `{videoId}/...` (no extra prefix, the bucket is the discriminator).
 */
export async function uploadHlsDirectory(localDir: string, videoId: string): Promise<number> {
    return uploadDirectory(localDir, videoId, HLS_BUCKET);
}

/**
 * Upload the DASH output directory to the DASH bucket.
 * Files are stored under `{videoId}/...`.
 */
export async function uploadDashDirectory(localDir: string, videoId: string): Promise<number> {
    return uploadDirectory(localDir, videoId, DASH_BUCKET);
}

// ---- Get ----

/**
 * Return a stream of the object in MinIO along with its metadata.
 */
export async function getObjectStream(
    key: string,
    bucket: string = HLS_BUCKET,
): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
    cacheControl?: string;
    etag?: string;
    lastModified?: Date;
    contentRange?: string;
    acceptRanges?: string;
} | null> {
    try {
        const res = await s3.send(new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }));

        if (!res.Body) return null;

        return {
            stream: res.Body as Readable,
            contentType: res.ContentType,
            contentLength: res.ContentLength,
            cacheControl: res.CacheControl,
            etag: res.ETag,
            lastModified: res.LastModified,
            acceptRanges: res.AcceptRanges,
        };
    } catch (err: any) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
            return null;
        }
        throw err;
    }
}

// ---- Existence ----

export async function objectExists(
    key: string,
    bucket: string = HLS_BUCKET,
): Promise<boolean> {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch (err: any) {
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
            return false;
        }
        throw err;
    }
}

/**
 * Check existence in a specific bucket. Convenience wrapper.
 */
export async function objectExistsInBucket(key: string, bucket: string): Promise<boolean> {
    return objectExists(key, bucket);
}

// ---- Delete ----

export async function deletePrefix(
    s3Prefix: string,
    bucket: string = HLS_BUCKET,
): Promise<number> {
    const prefix = s3Prefix.endsWith('/') ? s3Prefix : `${s3Prefix}/`;

    const list = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
    }));

    if (!list.Contents || list.Contents.length === 0) return 0;

    const keys = list.Contents
        .map((obj) => obj.Key)
        .filter((k): k is string => !!k)
        .map((Key) => ({ Key }));

    await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys, Quiet: true },
    }));

    logger.info(`[s3] Deleted ${keys.length} objects with prefix "${prefix}" from "${bucket}"`);
    return keys.length;
}

/**
 * Delete a prefix in a specific bucket. Convenience wrapper.
 */
export async function deletePrefixInBucket(s3Prefix: string, bucket: string): Promise<number> {
    return deletePrefix(s3Prefix, bucket);
}

export { HLS_BUCKET, DASH_BUCKET };
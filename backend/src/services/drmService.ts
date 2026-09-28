import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../logger';

export interface DrmKey {
    kid: string;    // hex, 32 chars (16 bytes)
    keyHex: string; // hex, 32 chars (16 bytes)
    videoId: string;
}

/**
 * Genera un par KID/KEY aleatorio para un video.
 * KID = Key ID (público, identifica la clave)
 * KEY = clave secreta de cifrado (AES-128)
 */
export function generateDrmKey(videoId: string): DrmKey {
    const keyBuffer = crypto.randomBytes(16);
    const kidBuffer = crypto.randomBytes(16);

    return {
        kid: kidBuffer.toString('hex'),
        keyHex: keyBuffer.toString('hex'),
        videoId,
    };
}


export async function registerKeyWithLicenseService(drmKey: DrmKey): Promise<void> {
    if (!config.drm.enabled) {
        logger.info('[drm] DRM disabled, skipping key registration');
        return;
    }

    const url = `${config.drm.licenseServiceUrl}/api/keys`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kid: drmKey.kid,
                key_hex: drmKey.keyHex,
                video_id: drmKey.videoId,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`License Service responded ${response.status}: ${errorText}`);
        }

        logger.info(`[drm] Registered KID ${drmKey.kid} for video ${drmKey.videoId}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message, url }, '[drm] Failed to register key');
        throw err;
    }
}
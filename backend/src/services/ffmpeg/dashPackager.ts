import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { TranscodeResult } from './transcodeToMp4';
import { logger } from '../../logger';
import { config } from '../../config';

export interface DashOptions {
    transcode: TranscodeResult;
    outputDir: string;
    videoId: string;
    kid: string;
    keyHex: string;
    licenseServiceUrl: string;
    signal?: AbortSignal;
}

export interface DashPackagedResult {
    dashDir: string;
    manifestPath: string;
}

function runBinary(
    binaryPath: string,
    args: string[],
    label: string,
    cwd: string,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('CANCELLED'));

        const resolved = path.resolve(binaryPath);
        if (!fs.existsSync(resolved)) {
            return reject(new Error(`Binary not found at ${resolved}`));
        }

        const proc = spawn(resolved, args, { cwd, windowsHide: true, signal });
        let stderr = '';
        let stdout = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code, sig) => {
            if (signal?.aborted || sig === 'SIGTERM') return reject(new Error('CANCELLED'));
            if (code === 0) return resolve();
            logger.error(
                { label, code, stderr: stderr.slice(-2000), stdout: stdout.slice(-500) },
                `[dash-packager] ${label} failed`
            );
            reject(new Error(`${label} exited with code ${code}`));
        });

        proc.on('error', (err: any) => {
            if (err?.name === 'AbortError' || signal?.aborted) return reject(new Error('CANCELLED'));
            reject(err);
        });
    });
}

function runPythonScript(
    pythonBin: string,
    scriptPath: string,
    args: string[],
    label: string,
    cwd: string,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('CANCELLED'));

        const resolvedScript = path.resolve(scriptPath);
        if (!fs.existsSync(resolvedScript)) {
            return reject(new Error(`Python script not found at ${resolvedScript}`));
        }

        const proc = spawn(pythonBin, [resolvedScript, ...args], {
            cwd,
            windowsHide: true,
            signal,
        });

        let stderr = '';
        let stdout = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code, sig) => {
            if (signal?.aborted || sig === 'SIGTERM') return reject(new Error('CANCELLED'));
            if (code === 0) return resolve();
            logger.error(
                { label, code, stderr: stderr.slice(-2000), stdout: stdout.slice(-500) },
                `[dash-packager] ${label} failed`
            );
            reject(new Error(`${label} exited with code ${code}`));
        });

        proc.on('error', (err: any) => {
            if (err?.name === 'AbortError' || signal?.aborted) return reject(new Error('CANCELLED'));
            reject(err);
        });
    });
}

export async function packageDASH(options: DashOptions): Promise<DashPackagedResult> {
    const {
        transcode,
        outputDir,
        videoId,
        kid,
        keyHex,
        licenseServiceUrl,
        signal,
    } = options;

    // Normalizar todas las rutas a absolutas
    const absOutputDir = path.resolve(outputDir);
    const dashDir = path.resolve(absOutputDir, videoId, 'dash');
    const fragDir = path.resolve(dashDir, '_frag');

    if (!fs.existsSync(dashDir)) fs.mkdirSync(dashDir, { recursive: true });

    logger.info(
        {
            videoId,
            kid,
            dashDir,
            qualities: transcode.videoMp4s.length,
            audios: transcode.audioMp4s.length,
            licenseServiceUrl,
        },
        '[dash-packager] Starting DASH packaging'
    );

    // se fragmentan los mp4
    const fragmentedPaths: string[] = [];
    fs.mkdirSync(fragDir, { recursive: true });

    const allMp4s = [...transcode.videoMp4s, ...transcode.audioMp4s];
    for (const mp4 of allMp4s) {
        const baseName = path.basename(mp4.path, '.mp4');
        const absoluteInput = path.resolve(mp4.path);
        const absoluteOutput = path.resolve(fragDir, `${baseName}_frag.mp4`);

        if (!fs.existsSync(absoluteInput)) {
            throw new Error(`Input MP4 not found: ${absoluteInput}`);
        }

        logger.info(
            { input: absoluteInput, output: absoluteOutput },
            `[dash-packager] Fragmenting ${baseName}`
        );

        await runBinary(
            config.drm.mp4fragmentPath,
            [absoluteInput, absoluteOutput],
            `fragment ${baseName}`,
            dashDir,
            signal
        );
        fragmentedPaths.push(absoluteOutput);
    }

    // empaquetar y cifrar con mp4dash
    const mp4dashArgs: string[] = [
        '--clearkey',
        '--encryption-cenc-scheme=cbcs',
        `--clearkey-license-uri=${licenseServiceUrl}/api/license`,
        `--encryption-key=${kid}:${keyHex}`,
        `--output-dir=${dashDir}`,
        '--force',
        ...fragmentedPaths,
    ];

    await runPythonScript(
        config.drm.pythonBin,
        config.drm.mp4dashScript,
        mp4dashArgs,
        'mp4-dash.py',
        process.cwd(),
        signal
    );

    // limpia los fragmentos intermedios
    try { fs.rmSync(fragDir, { recursive: true, force: true }); } catch {}

    const manifestPath = path.resolve(dashDir, 'stream.mpd');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`mp4-dash.py did not produce stream.mpd at ${manifestPath}`);
    }

    logger.info(
        { videoId, manifestPath },
        '[dash-packager] DASH packaging complete'
    );

    return {
        dashDir,
        manifestPath,
    };
}
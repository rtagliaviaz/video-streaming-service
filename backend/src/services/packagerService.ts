import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../logger';

export interface PackagerVideoInput {
    filePath: string;
    quality: string; 
    bandwidth: number; 
}

export interface PackagerAudioInput {
    filePath: string;
    index: number; 
    language: string;  
    name: string;   
}

export interface PackagerOptions {
    videoInputs: PackagerVideoInput[];
    audioInputs: PackagerAudioInput[];
    subtitleInputs?: { filePath: string; language: string; name: string }[];
    outputDir: string;
    kid: string;
    keyHex: string;
    licenseUrl: string;
    segmentDuration?: number;
}

/*
  - {outputDir}/index.m3u8  (master)
  - {outputDir}/{quality}.m3u8 + segmentos (por calidad)
  - {outputDir}/audio_{index}.m3u8 + segmentos (por pista de audio)
  - {outputDir}/{quality}_init.mp4, {quality}_000.m4s, etc.
*/
export async function packageWithClearKey(opts: PackagerOptions): Promise<void> {
  const {
    videoInputs,
    audioInputs,
    subtitleInputs = [],
    outputDir,
    kid,
    keyHex,
    licenseUrl,
    segmentDuration = 2,
  } = opts;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const args: string[] = [];

  for (const video of videoInputs) {
    args.push(
      `in=${video.filePath},` +
      `stream=video,` +
      `init_segment=${video.quality}_init.mp4,` +
      `segment_template=${video.quality}_$Number$.m4s,` +
      `playlist_name=${video.quality}.m3u8`
  );
  }

  for (const audio of audioInputs) {
    args.push(
      `in=${audio.filePath},` +
      `stream=audio,` +
      `init_segment=audio_${audio.index}_init.mp4,` +
      `segment_template=audio_${audio.index}_$Number$.m4s,` +
      `playlist_name=audio_${audio.index}.m3u8,` +
      `hls_group_id=audio,` +
      `hls_name=${audio.name},` +
      `lang=${audio.language}`
    );
  }

  // encryptions args
  args.push('--enable_raw_key_encryption');
  args.push('--keys', `label=:key_id=${kid}:key=${keyHex}`);
  args.push('--protection_scheme', 'cenc');
  args.push('--hls_key_uri', licenseUrl);

  // hsl output
  args.push('--segment_duration', String(segmentDuration));
  args.push('--hls_master_playlist_output', path.join(outputDir, 'index.m3u8'));

  // logs
  args.push('--v', 'log');

  logger.info(
    {
      videoCount: videoInputs.length,
      audioCount: audioInputs.length,
      outputDir,
      kid,
    },
    '[packager] Running Shaka Packager'
  );

  await runPackager(args, outputDir);
}

function runPackager(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const packagerPath = path.resolve(config.drm.packagerPath);

    if (!fs.existsSync(packagerPath)) {
      return reject(
          new Error(`Shaka Packager not found at ${packagerPath}`)
      );
    }

    const proc = spawn(packagerPath, args, {
      cwd,
      windowsHide: true,
    });

    let stderr = '';
    let stdout = '';

    proc.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      // Log cada línea para ver el progreso de Shaka
      chunk
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .forEach((line: string) => logger.debug(`[packager] ${line}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info('[packager] Packaging completed successfully');
        resolve();
      } else {
        logger.error(
          { code, stderr: stderr.slice(-2000) },
          '[packager] Packaging failed'
        );
        reject(
          new Error(`Shaka Packager exited with code ${code}`)
        );
      }
    });

    proc.on('error', (err) => {
      logger.error({ err: err.message }, '[packager] Spawn error');
      reject(err);
    });
  });
}

import { describe, it, expect, vi } from 'vitest';

describe('gpuDetector', () => {
  it('should detect NVIDIA GPU and NVENC (h264_nvenc) when HEVC not available', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
            // Simula solo h264_nvenc (sin hevc_nvenc)
            return Promise.resolve({ stdout: 'h264_nvenc', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        };
      }),
    }));

    vi.resetModules();
    const { checkGPUAvailability } = await import('./gpuDetector.js');

    const result = await checkGPUAvailability();
    expect(result.hasGPU).toBe(true);
    expect(result.encoder).toBe('h264_nvenc');
    expect(result.gpuInfo).toBe('NVIDIA GeForce RTX 3060');
    expect(result.supportsHevc).toBe(false);
  });

  it('should detect HEVC NVENC when available on Windows', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
            // Simula ambos encoders
            return Promise.resolve({ stdout: 'h264_nvenc\nhevc_nvenc', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        };
      }),
    }));

    // Forzar Windows para este test
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.resetModules();
    const { checkGPUAvailability } = await import('./gpuDetector.js');

    const result = await checkGPUAvailability();
    expect(result.hasGPU).toBe(true);
    expect(result.encoder).toBe('hevc_nvenc');
    expect(result.gpuInfo).toBe('NVIDIA GeForce RTX 3060');
    expect(result.supportsHevc).toBe(true);

    // Restaurar plataforma
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should fallback to h264_nvenc on Windows when HEVC not available', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
            // Solo h264_nvenc
            return Promise.resolve({ stdout: 'h264_nvenc', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        };
      }),
    }));

    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.resetModules();
    const { checkGPUAvailability } = await import('./gpuDetector.js');

    const result = await checkGPUAvailability();
    expect(result.hasGPU).toBe(true);
    expect(result.encoder).toBe('h264_nvenc');
    expect(result.supportsHevc).toBe(false);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should force libx264 on Linux even if GPU is detected', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
            return Promise.resolve({ stdout: 'h264_nvenc\nhevc_nvenc', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        };
      }),
    }));

    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.resetModules();
    const { checkGPUAvailability } = await import('./gpuDetector.js');

    const result = await checkGPUAvailability();
    // En Linux forzamos CPU, por lo que hasGPU es false
    expect(result.hasGPU).toBe(false);
    expect(result.encoder).toBe('libx264');
    expect(result.supportsHevc).toBe(false);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });


  it('should fallback to CPU when nvidia-smi fails', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.reject(new Error('nvidia-smi not found'));
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        };
      }),
    }));

    vi.resetModules();
    const { checkGPUAvailability } = await import('./gpuDetector.js');

    const result = await checkGPUAvailability();
    expect(result.hasGPU).toBe(false);
    expect(result.encoder).toBe('libx264');
    expect(result.supportsHevc).toBe(false);
  });

  it('should fallback to CPU when NVENC test fails', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
            // No muestra ningún encoder NVENC
            return Promise.resolve({ stdout: '', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        };
      }),
    }));

    vi.resetModules();
    const { checkGPUAvailability } = await import('./gpuDetector.js');

    const result = await checkGPUAvailability();
    expect(result.hasGPU).toBe(false);
    expect(result.encoder).toBe('libx264');
    expect(result.supportsHevc).toBe(false);
  });
});
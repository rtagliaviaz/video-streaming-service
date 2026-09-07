import { describe, it, expect, vi } from 'vitest';

describe('gpuDetector', () => {
  it('should detect NVIDIA GPU and NVENC', async () => {
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
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
  });

  it('should fallback to CPU when NVENC test fails', async () => {
    // mock promisify para que ffmpeg -encoders devuelva vacío (sin h264_nvenc)
    vi.doMock('util', () => ({
      promisify: vi.fn().mockImplementation(() => {
        return (command: string) => {
          if (command.includes('nvidia-smi')) {
            return Promise.resolve({ stdout: 'NVIDIA GeForce RTX 3060', stderr: '' });
          }
          if (command.includes('ffmpeg -encoders')) {
            // simula que no se encuentra el encoder
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
  });
});
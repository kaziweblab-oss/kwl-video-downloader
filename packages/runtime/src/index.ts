import { AppVersionInfo, PlatformName } from '@kwl/shared';

export type RuntimeBinary = 'yt-dlp' | 'ffmpeg' | 'ffprobe';

export interface RuntimeInfo {
  binary: RuntimeBinary;
  resolvedPath: string | null;
  version: string | null;
  available: boolean;
  verified: boolean;
  isBundled: boolean;
  platform: PlatformName;
}

export interface RuntimeManager {
  resolveYtDlp(): Promise<string | null>;
  resolveFfmpeg(): Promise<string | null>;
  resolveFfprobe(): Promise<string | null>;
  verifyRuntime(binary: RuntimeBinary, resolvedPath: string): Promise<boolean>;
  getRuntimeInfo(): Promise<RuntimeInfo[]>;
}

export class DefaultRuntimeManager implements RuntimeManager {
  private readonly platform: PlatformName = 'windows';

  async resolveYtDlp(): Promise<string | null> {
    return this.resolveByPriority('yt-dlp');
  }

  async resolveFfmpeg(): Promise<string | null> {
    return this.resolveByPriority('ffmpeg');
  }

  async resolveFfprobe(): Promise<string | null> {
    return this.resolveByPriority('ffprobe');
  }

  async verifyRuntime(binary: RuntimeBinary, resolvedPath: string): Promise<boolean> {
    if (!resolvedPath || resolvedPath.trim().length === 0) {
      return false;
    }

    if (resolvedPath.includes('..') || resolvedPath.includes('\0')) {
      return false;
    }

    if (!['yt-dlp', 'ffmpeg', 'ffprobe'].includes(binary)) {
      return false;
    }

    return true;
  }

  async getRuntimeInfo(): Promise<RuntimeInfo[]> {
    const binaries: RuntimeBinary[] = ['yt-dlp', 'ffmpeg', 'ffprobe'];

    return Promise.all(
      binaries.map(async (binary) => {
        const resolvedPath = await this.resolveByPriority(binary);
        const verified = resolvedPath ? await this.verifyRuntime(binary, resolvedPath) : false;

        return {
          binary,
          resolvedPath,
          version: verified ? 'unknown' : null,
          available: Boolean(resolvedPath),
          verified,
          isBundled: resolvedPath !== null && resolvedPath.includes('resources/runtime'),
          platform: this.platform,
        };
      })
    );
  }

  private async resolveByPriority(binary: RuntimeBinary): Promise<string | null> {
    const envValue = this.readEnvironmentValue(binary);
    if (envValue) {
      return envValue;
    }

    const bundled = this.getExpectedBundledPath(binary);
    if (bundled) {
      return bundled;
    }

    return null;
  }

  private readEnvironmentValue(binary: RuntimeBinary): string | null {
    const envKey = {
      'yt-dlp': 'KWL_YTDLP_PATH',
      ffmpeg: 'KWL_FFMPEG_PATH',
      ffprobe: 'KWL_FFPROBE_PATH',
    }[binary];

    const value = typeof process !== 'undefined' ? process.env?.[envKey ?? ''] : undefined;
    if (!value || value.trim().length === 0) {
      return null;
    }

    if (value.includes('..')) {
      return null;
    }

    return value;
  }

  private getExpectedBundledPath(binary: RuntimeBinary): string | null {
    const base = 'resources/runtime/windows-x64';
    switch (binary) {
      case 'yt-dlp':
        return `${base}/yt-dlp.exe`;
      case 'ffmpeg':
        return `${base}/ffmpeg.exe`;
      case 'ffprobe':
        return `${base}/ffprobe.exe`;
      default:
        return null;
    }
  }
}

export function createRuntimeManager(): RuntimeManager {
  return new DefaultRuntimeManager();
}

export function getAppVersionInfo(name: string, version: string, platform: PlatformName): AppVersionInfo {
  return {
    name,
    version,
    platform,
    environment: 'development',
  };
}

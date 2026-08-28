export type RuntimeCommand = 'yt-dlp' | 'ffmpeg' | 'ffprobe';

export interface NativeExecutionRequest {
  command: RuntimeCommand;
  args: string[];
  cwd?: string;
}

export interface NativeExecutionResult {
  command: RuntimeCommand;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface NativeExecutor {
  execute(request: NativeExecutionRequest): Promise<NativeExecutionResult>;
}

export class SafeNativeExecutor implements NativeExecutor {
  async execute(request: NativeExecutionRequest): Promise<NativeExecutionResult> {
    const sanitizedArgs = request.args.map((arg) => String(arg).replace(/\0/g, ''));

    if (request.command === 'yt-dlp' && sanitizedArgs.some((arg) => arg.includes('&&')))
      throw new Error('Command injection blocked');

    return {
      command: request.command,
      exitCode: 0,
      stdout: `${request.command} executed`,
      stderr: '',
    };
  }
}

export function createNativeExecutor(): NativeExecutor {
  return new SafeNativeExecutor();
}

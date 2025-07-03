import type { Context } from "@oomol/types/oocana";
import { spawn } from 'child_process';
import * as ffmpeg from "@ffmpeg-installer/ffmpeg";


export abstract class FFmpegExecutor {
    protected context?: Context<any, any>;
    protected totalDuration: number = 0;

    constructor(context?: Context<any, any>) {
        this.context = context;
    }

    protected runFFmpegCommand(args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('Running FFmpeg command:', ffmpeg.path, args.join(' '));

            const process = spawn(ffmpeg.path, args);
            let stderr = '';

            process.stdout.on('data', (data) => {
                console.log('FFmpeg stdout:', data.toString());
            });

            process.stderr.on('data', (data) => {
                const dataStr = data.toString();
                stderr += dataStr;
                console.log('FFmpeg stderr:', dataStr);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    console.log('FFmpeg command completed successfully');
                    resolve();
                } else {
                    console.error('FFmpeg command failed with code:', code);
                    console.error('stderr:', stderr);
                    reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                console.error('Failed to start FFmpeg process:', error);
                reject(error);
            });
        });
    }
}

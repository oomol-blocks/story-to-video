import { spawn } from 'child_process';
import * as fs from 'node:fs/promises';
import * as ffmpeg from "@ffmpeg-installer/ffmpeg";
import * as ffprobe from "@ffprobe-installer/ffprobe";

export interface AudioInfo {
    sampleRate: number;
    channels: number;
    channelLayout: string;
    duration: number;
    fileSize: number;
    bitrate?: number;
    codec?: string;
}

export interface VideoInfo {
    width: number;
    height: number;
    duration: number;
    frameRate: number;
    codec?: string;
    bitrate?: number;
    fileSize: number;
}

export abstract class FFmpegExecutor {
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

    protected runFFprobeCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log('Running FFprobe command:', ffprobe.path, args.join(' '));

            const process = spawn(ffprobe.path, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                const dataStr = data.toString();
                stdout += dataStr;
                console.log('FFprobe stdout:', dataStr);
            });

            process.stderr.on('data', (data) => {
                const dataStr = data.toString();
                stderr += dataStr;
                console.log('FFprobe stderr:', dataStr);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    console.log('FFprobe command completed successfully');
                    resolve(stdout);
                } else {
                    console.error('FFprobe command failed with code:', code);
                    console.error('stderr:', stderr);
                    reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                console.error('Failed to start FFprobe process:', error);
                reject(error);
            });
        });
    }

    protected async getVideoDuration(inputPath: string): Promise<number> {
        const args = [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            inputPath
        ];

        const output = await this.runFFprobeCommand(args);
        return parseFloat(output.trim());
    }

    protected async getAudioDuration(audioPath: string): Promise<number> {
        const args = [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            audioPath
        ];

        try {
            const output = await this.runFFprobeCommand(args);
            const duration = parseFloat(output.trim());

            if (isNaN(duration)) {
                throw new Error('Could not parse audio duration from FFprobe output');
            }

            return duration;
        } catch (error) {
            throw new Error(`Failed to get audio duration: ${error.message}`);
        }
    }

    async getAudioInfo(inputPath: string): Promise<AudioInfo> {
        const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',  // 同时获取格式信息
            '-select_streams', 'a:0',
            inputPath
        ];

        try {
            const output = await this.runFFprobeCommand(args);
            const data = JSON.parse(output);
            const stream = data.streams[0];
            const format = data.format;

            if (!stream) {
                throw new Error('No audio stream found in input file');
            }

            const sampleRate = parseInt(stream.sample_rate) || 44100;
            const channels = parseInt(stream.channels) || 1;
            const bitrate = parseInt(stream.bit_rate) || parseInt(format?.bit_rate) || undefined;
            const codec = stream.codec_name || undefined;

            // 根据声道数确定 channel_layout
            let channelLayout: string;
            if (channels === 1) {
                channelLayout = 'mono';
            } else if (channels === 2) {
                channelLayout = 'stereo';
            } else if (channels === 6) {
                channelLayout = '5.1';
            } else if (channels === 8) {
                channelLayout = '7.1';
            } else {
                channelLayout = `${channels}c`; // 多声道格式
            }

            // 优先使用 stream 的 duration，其次使用 format 的 duration
            let duration = parseFloat(stream.duration);
            if (isNaN(duration) || duration <= 0) {
                duration = parseFloat(format?.duration);
            }

            // 如果还是获取不到，则回退到单独调用
            if (isNaN(duration) || duration <= 0) {
                console.warn('Could not get duration from probe data, falling back to separate call');
                duration = await this.getAudioDuration(inputPath);
            }

            // 获取文件大小
            const fileSize = await this.getFileSize(inputPath);

            console.log(
                `Audio info: ${sampleRate}Hz, ${channels}ch (${channelLayout}), ${duration.toFixed(2)}s, ${this.formatFileSize(fileSize)}`
            );

            return {
                sampleRate,
                channels,
                channelLayout,
                duration,
                bitrate,
                codec,
                fileSize
            };
        } catch (error) {
            // 如果解析失败，使用默认值
            console.warn(`Warning: Could not get audio info, using defaults: ${error.message}`);
            const fallbackFileSize = await this.getFileSize(inputPath);
            return {
                sampleRate: 44100,
                channels: 2,
                channelLayout: 'stereo',
                duration: await this.getAudioDuration(inputPath),
                fileSize: fallbackFileSize
            };
        }
    }

    async getVideoInfo(inputPath: string): Promise<VideoInfo> {
        const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',  // 同时获取格式信息
            '-select_streams', 'v:0',
            inputPath
        ];

        try {
            const output = await this.runFFprobeCommand(args);
            const data = JSON.parse(output);
            const stream = data.streams[0];
            const format = data.format;

            if (!stream) {
                throw new Error('No video stream found in input file');
            }

            const width = parseInt(stream.width) || 0;
            const height = parseInt(stream.height) || 0;
            const bitrate = parseInt(stream.bit_rate) || parseInt(format?.bit_rate) || undefined;
            const codec = stream.codec_name || undefined;

            // 优先使用 stream 的 duration，其次使用 format 的 duration
            let duration = parseFloat(stream.duration);
            if (isNaN(duration) || duration <= 0) {
                duration = parseFloat(format?.duration);
            }

            // 如果还是获取不到，则回退到单独调用
            if (isNaN(duration) || duration <= 0) {
                console.warn('Could not get duration from probe data, falling back to separate call');
                duration = await this.getVideoDuration(inputPath);
            }

            // 解析帧率
            let frameRate = 30; // 默认值
            if (stream.r_frame_rate) {
                const [num, den] = stream.r_frame_rate.split('/').map(Number);
                if (den && den > 0) {
                    frameRate = num / den;
                }
            }

            // 获取文件大小
            const fileSize = await this.getFileSize(inputPath);

            console.log(
                `Video info: ${width}x${height}, ${frameRate.toFixed(2)}fps, ${duration.toFixed(2)}s, ${this.formatFileSize(fileSize)}`
            );

            return {
                width,
                height,
                duration,
                frameRate,
                codec,
                bitrate,
                fileSize
            };
        } catch (error) {
            throw new Error(`Failed to get video info: ${error.message}`);
        }
    }

    protected async getFileSize(filePath: string): Promise<number> {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            console.warn(`Warning: Failed to get file size for ${filePath}: ${error.message}`);
            return 0;
        }
    }

    protected formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

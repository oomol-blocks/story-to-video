import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { FFmpegExecutor } from "./FFmpegExcutor";
import { SubtitleAsset } from "./SubtitleGenerator";
import { AudioAsset } from "./AudioGenerator";
import { ImageAsset } from "./ImageGenarator";
import { MediaAsset, VideoConfig } from "./constants";
import { FileType, IFileManager, ManagedFile } from "../file/FileManager";

export interface VideoAsset extends MediaAsset {
    duration: number;
    resolution: string;
}

export interface VideoGeneratorInputs {
    imageAssets: ImageAsset[],
    audioAssets: AudioAsset[],
    subtitleAssets: SubtitleAsset[],
    config: VideoConfig;
    outputDir?: string;
}

export interface Segment {
    id: string;
    imageAsset: ImageAsset;
    audioAsset: AudioAsset;
    subtitleAsset: SubtitleAsset;
    nextImageAsset?: ImageAsset;
}

export interface VideoGeneratorOutputs {
    videoAssets: VideoAsset[];
    mergedVideoAsset?: VideoAsset;
}

export class DoubaoVideoGenerator extends FFmpegExecutor {
    // 暂不支持修改
    private apiEndpoint: string = "https://ark.cn-beijing.volces.com/api/v3";
    private model: string = "doubao-seedance-1-0-lite-i2v-250428";

    private apiKey: string;
    constructor(private context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>) {
        super();
    }

    async generateSingleVideoSegmentToPath(
        segment: Segment,
        config: VideoConfig,
        tempOutputPath: string,
        finalOutputPath: string
    ): Promise<VideoAsset> {
        // 初始化API密钥
        this.apiKey = config.apiKey;

        // 确保输出目录存在
        await this.ensureDirectory(path.dirname(tempOutputPath));
        await this.ensureDirectory(path.dirname(finalOutputPath));

        try {
            // 生成并下载视频段
            const videoUrl = await this.callVideoAPI(segment);
            await this.downloadVideo(videoUrl, tempOutputPath);

            // 合成音频和字幕
            await this.compositeVideo(segment, tempOutputPath, finalOutputPath, config);

            // 获取视频信息
            const videoInfo = await this.getVideoInfo(finalOutputPath);

            const videoAsset: VideoAsset = {
                id: segment.id,
                filePath: finalOutputPath,
                duration: videoInfo.duration,
                resolution: config.size,
                fileSize: videoInfo.fileSize,
                format: config.format,
                createdAt: new Date()
            };

            return videoAsset;
        } catch (error) {
            throw error;
        }
    }

    async mergeVideoSegmentsToPath(
        videoAssets: VideoAsset[],
        config: VideoConfig,
        outputPath: string
    ): Promise<VideoAsset> {
        try {
            await this.runFFmpegMerge(videoAssets, outputPath, config);

            const videoInfo = await this.getVideoInfo(outputPath);

            return {
                id: 'merged',
                filePath: outputPath,
                duration: videoInfo.duration,
                resolution: config.size,
                fileSize: videoInfo.fileSize,
                format: config.format,
                createdAt: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to merge video segments: ${error.message}`);
        }
    }

    private async callVideoAPI(segment: Segment): Promise<string> {
        try {
            console.log(segment.imageAsset.prompt, segment.audioAsset.timing.duration)
            const prompt = `${segment.imageAsset.prompt} --rs 720p --dur ${Math.ceil(segment.audioAsset.timing.duration)}`;

            const content = [
                {
                    type: "text",
                    text: prompt
                },
                {
                    type: "image_url",
                    image_url: {
                        url: segment.imageAsset.url
                    },
                    role: "first_frame"
                }
            ];

            if (segment.nextImageAsset) {
                content.push({
                    type: "image_url",
                    image_url: {
                        url: segment.nextImageAsset.url
                    },
                    role: "last_frame"
                });
            }

            const taskCreateRequest = {
                model: this.model,
                content
            };

            const createResponse = await this.createDoubaoTask(taskCreateRequest);
            this.context.reportLog(`Task created: ${createResponse.id}`, "stdout");

            const videoUrl = await this.pollTaskStatus(createResponse.id);
            this.context.reportLog(`Video generated: ${videoUrl}`, "stdout");

            return videoUrl;
        } catch (error) {
            throw new Error(`Failed to call video API: ${error.message}`);
        }
    }

    private async downloadVideo(url: string, filePath: string): Promise<void> {
        this.context.reportLog(`Downloading video from: ${url}`, "stdout");

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download video: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));

            this.context.reportLog(`✓ Video downloaded to: ${filePath}`, "stdout");
        } catch (error) {
            throw new Error(`Failed to download video: ${error.message}`);
        }
    }

    private async compositeVideo(
        segment: Segment,
        inputPath: string,
        outputPath: string,
        config: VideoConfig
    ): Promise<void> {
        this.context.reportLog(`Compositing video with audio and subtitles`, "stdout");

        try {
            // 验证输入文件
            await fs.access(inputPath);
            await fs.access(segment.audioAsset.filePath);
            await fs.access(segment.subtitleAsset.filePath);

            const resolution = config.size.replace('x', ':');

            // 构建 FFmpeg 命令
            const filterComplex = `subtitles='${segment.subtitleAsset.filePath.replace(/'/g, "\\'")}',scale=${resolution}`;

            const args = [
                '-y',
                '-i', inputPath,
                '-i', segment.audioAsset.filePath,
                '-c:v', "libx264",
                '-c:a', 'aac',
                '-b:a', '128k',
                '-pix_fmt', 'yuv420p',
                '-vf', filterComplex,
                '-t', Math.ceil(segment.audioAsset.timing.duration).toString(),
                '-shortest',
                outputPath
            ];

            await this.runFFmpegCommand(args);
            this.context.reportLog(`✓ Video composite completed: ${outputPath}`, "stdout");
        } catch (error) {
            throw new Error(`Failed to composite video: ${error.message}`);
        }
    }

    private async runFFmpegMerge(
        videoAssets: VideoAsset[],
        outputPath: string,
        config: VideoConfig
    ): Promise<void> {
        if (videoAssets.length === 0) {
            throw new Error('No video assets to merge');
        }

        if (videoAssets.length === 1) {
            await fs.copyFile(videoAssets[0].filePath, outputPath);
            return;
        }

        const fileListPath = path.join(path.dirname(outputPath), 'filelist.txt');
        const fileListContent = videoAssets.map(asset => `file '${asset.filePath}'`).join('\n');
        await fs.writeFile(fileListPath, fileListContent, 'utf8');

        try {
            const resolution = config.size.replace('x', ':');

            const mergeArgs = [
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', fileListPath,
                '-c:v', "libx264",
                '-c:a', 'aac',
                '-vf', `scale=${resolution}`,
                '-pix_fmt', 'yuv420p',
                outputPath
            ];

            await this.runFFmpegCommand(mergeArgs);
            await fs.unlink(fileListPath).catch(() => { });

            this.context.reportLog(`✓ Video merge completed: ${outputPath}`, "stdout");
        } catch (error) {
            await fs.unlink(fileListPath).catch(() => { });
            throw error;
        }
    }

    private async createDoubaoTask(request: any): Promise<any> {
        const response = await fetch(`${this.apiEndpoint}/contents/generations/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create Doubao task: ${response.status} ${errorText}`);
        }

        return await response.json();
    }

    private async pollTaskStatus(taskId: string): Promise<string> {
        const maxAttempts = 60;
        const pollInterval = 10000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`${this.apiEndpoint}/contents/generations/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get task status: ${response.status} ${errorText}`);
            }

            const taskResponse = await response.json();
            this.context.reportLog(`Task ${taskId} status: ${taskResponse.status}`, "stdout");

            if (taskResponse.status === 'succeeded') {
                if (!taskResponse.content?.video_url) {
                    throw new Error('Video URL not found in completed task');
                }
                return taskResponse.content.video_url;
            } else if (taskResponse.status === 'failed') {
                throw new Error(`Task failed: ${taskResponse.error}`);
            } else if (taskResponse.status === 'cancelled') {
                throw new Error('Task was cancelled');
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
    }

    private async ensureDirectory(dir: string) {
        return await fs.mkdir(dir, { recursive: true });
    }
}

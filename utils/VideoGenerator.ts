import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { FFmpegExecutor } from "./FFmpegExcutor";
import { SubtitleAsset } from "./SubtitleGenerator";
import { AudioAsset } from "./AudioGenerator";
import { ImageAsset } from "./ImageGenarator";
import { ScriptScene } from "./ScriptParser";
import { VideoSizeType } from "./constants";

export interface VideoAsset {
    filePath: string;
    duration: number;
    resolution: string;
    fileSize: number;
}

export interface VideoGeneratorInputs {
    scenes: ScriptScene[];
    audioAssets: AudioAsset[];
    imageAssets: ImageAsset[];
    subtitleAssets: SubtitleAsset[];
    outputDir: string;
    videoSize: VideoSizeType;
    IMAGE_API_KEY: string;
}

export interface VideoGeneratorOutputs {
    videoAsset: VideoAsset;
}

// 豆包API相关接口
interface DoubaoTaskCreateRequest {
    model: string;
    content: Array<{
        type: string;
        text?: string;
        image_url?: {
            url: string;
        };
        role?: string;
    }>;
}

interface DoubaoTaskCreateResponse {
    id: string;
    model: string;
    status: string;
    created_at: number;
}

interface DoubaoTaskGetResponse {
    id: string;
    model: string;
    status: string;
    error?: string;
    content?: {
        video_url?: string;
    };
    usage?: {
        completion_tokens: number;
        total_tokens: number;
    };
    created_at: number;
    updated_at: number;
}

export class DoubaoVideoGenerator extends FFmpegExecutor {
    private API_KEY: string;
    private BASE_URL: string = "https://ark.cn-beijing.volces.com/api/v3";
    private MODEL: string = "doubao-seedance-1-0-lite-i2v-250428";

    async generateVideo(
        params: VideoGeneratorInputs,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>
    ): Promise<VideoGeneratorOutputs> {
        console.log("Starting video generation with Doubao API...");
        context.reportProgress(0);

        const startTime = Date.now();
        const {
            scenes,
            audioAssets,
            imageAssets,
            subtitleAssets,
            outputDir,
            videoSize,
            IMAGE_API_KEY
        } = params;

        this.API_KEY = IMAGE_API_KEY;

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        // 计算总时长用于进度计算
        this.totalDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);

        const videoSegments: string[] = [];

        // 为每个场景生成视频片段
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const audioAsset = audioAssets.find(asset => asset.sceneId === scene.id);
            const currentImageAsset = imageAssets.find(asset => asset.sceneId === scene.id);
            const subtitleAsset = subtitleAssets.find(asset => asset.sceneId === scene.id);

            if (!audioAsset || !currentImageAsset || !subtitleAsset) {
                console.warn(`Missing assets for scene ${scene.id}, skipping`);
                continue;
            }

            const nextImageAsset = i < scenes.length - 1
                ? imageAssets.find(asset => asset.sceneId === scenes[i + 1].id)
                : null;

            console.log(`Generating video segment for scene ${scene.id}`);

            // 生成视频片段
            const segmentOutput = path.join(outputDir, `segment_${scene.id}.mp4`);

            try {
                // 使用豆包API生成视频段
                const videoUrl = await this.generateVideoSegmentWithDoubao(
                    scene,
                    currentImageAsset,
                    nextImageAsset,
                    audioAsset.duration
                );

                // 下载生成的视频
                const rawVideoPath = path.join(outputDir, `raw_segment_${scene.id}.mp4`);
                await this.downloadVideo(videoUrl, rawVideoPath);

                // 使用FFmpeg合成音频和字幕
                await this.compositeVideoWithAudioAndSubtitles(
                    rawVideoPath,
                    audioAsset.filePath,
                    subtitleAsset.filePath,
                    segmentOutput,
                    audioAsset.duration,
                    videoSize
                );

                videoSegments.push(segmentOutput);

                // 清理临时文件
                await fs.unlink(rawVideoPath).catch(console.warn);

            } catch (error) {
                console.error(`Failed to generate video segment for scene ${scene.id}:`, error);
                continue;
            }

            const progress = ((i + 1) / scenes.length) * 80; // 80% 用于片段生成
            context.reportProgress(progress);

            console.log(`✓ Generated video segment for scene ${scene.id}`);
        }

        if (videoSegments.length === 0) {
            throw new Error('No video segments were generated');
        }

        // 合并视频片段
        const finalOutputPath = await this.mergeVideoSegments(
            videoSegments,
            outputDir,
            context,
            videoSize
        );

        const stats = await fs.stat(finalOutputPath);
        const processingTime = Date.now() - startTime;
        const totalDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);

        // 清理临时文件
        // try {
        //     await this.cleanupTemporaryFiles(
        //         audioAssets,
        //         imageAssets,
        //         subtitleAssets,
        //         videoSegments,
        //     );
        // } catch (error) {
        //     console.warn("Failed to cleanup some temporary files:", error);
        // }

        context.reportProgress(100);
        console.log(`✓ Video generation completed in ${processingTime}ms`);

        return {
            videoAsset: {
                filePath: finalOutputPath,
                duration: totalDuration,
                resolution: videoSize,
                fileSize: stats.size
            }
        };
    }

    private async generateVideoSegmentWithDoubao(
        scene: ScriptScene,
        firstFrameImageAsset: ImageAsset,
        lastFrameImageAsset: ImageAsset | null,
        duration: number
    ): Promise<string> {

        console.log(duration)
        console.log(`Generating video with Doubao API for scene ${scene.id}`);

        try {
            // 构建提示词，包含场景描述和视频参数
            const prompt = `${scene.visualPrompt} --rs 720p --dur ${Math.ceil(duration)}`;

            const content: DoubaoTaskCreateRequest['content'] = [
                {
                    type: "text",
                    text: prompt
                },
                {
                    type: "image_url",
                    image_url: {
                        url: firstFrameImageAsset.filePath
                    },
                    role: "first_frame"
                }
            ];

            const lastFrameUrl = lastFrameImageAsset
                ? lastFrameImageAsset.filePath
                : null;

            if (lastFrameUrl) {
                content.push({
                    type: "image_url",
                    image_url: {
                        url: lastFrameUrl
                    },
                    role: "last_frame"
                });
            }

            // 创建视频生成任务
            const taskCreateRequest: DoubaoTaskCreateRequest = {
                model: this.MODEL,
                content: content
            };

            // 创建任务
            const createResponse = await this.createDoubaoTask(taskCreateRequest);
            console.log(`Task created: ${createResponse.id}`);

            // 轮询任务状态
            const videoUrl = await this.pollTaskStatus(createResponse.id);
            console.log(`Video generated: ${videoUrl}`);

            return videoUrl;
        } catch (e) {
            throw new Error(`Failed to generate Doubao task: ${e}`);
        }
    }

    private async createDoubaoTask(request: DoubaoTaskCreateRequest): Promise<DoubaoTaskCreateResponse> {
        const response = await fetch(`${this.BASE_URL}/contents/generations/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.API_KEY}`
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
        const maxAttempts = 60; // 最大轮询次数
        const pollInterval = 10000; // 轮询间隔10秒

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`${this.BASE_URL}/contents/generations/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get task status: ${response.status} ${errorText}`);
            }

            const taskResponse: DoubaoTaskGetResponse = await response.json();

            console.log(`Task ${taskId} status: ${taskResponse.status}`);

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

            // 等待后继续轮询
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
    }

    private async downloadVideo(url: string, outputPath: string): Promise<void> {
        console.log(`Downloading video from: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        await fs.writeFile(outputPath, Buffer.from(buffer));

        console.log(`✓ Video downloaded to: ${outputPath}`);
    }

    private async compositeVideoWithAudioAndSubtitles(
        videoPath: string,
        audioPath: string,
        subtitlePath: string,
        outputPath: string,
        duration: number,
        videoSize: string
    ): Promise<void> {
        console.log(`Compositing video with audio and subtitles`);

        // 验证输入文件
        try {
            await fs.access(videoPath);
            await fs.access(audioPath);
            await fs.access(subtitlePath);
        } catch (error) {
            throw new Error(`Missing input files: ${error}`);
        }

        const [width, height] = videoSize.split('x');
        const size = `${width}:${height}`;

        const filterComplex = `subtitles='${subtitlePath.replace(/'/g, "\\'")}',scale=${size}`;

        const args = [
            '-y',
            '-i', videoPath,
            '-i', audioPath,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-pix_fmt', 'yuv420p',
            '-vf', filterComplex,
            '-t', duration.toString(),
            '-shortest',
            outputPath
        ];

        await this.runFFmpegCommand(args);
        console.log(`✓ Video composite completed: ${outputPath}`);
    }

    private async mergeVideoSegments(
        videoSegments: string[],
        outputDir: string,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        videoSize: string
    ): Promise<string> {
        const fileListPath = path.join(outputDir, 'filelist.txt');
        const fileListContent = videoSegments.map(segment => `file '${segment}'`).join('\n');
        await fs.writeFile(fileListPath, fileListContent, 'utf8');

        const finalOutputPath = path.join(outputDir, 'final_video.mp4');
        console.log("Merging video segments...");

        context.reportProgress(85);

        const [width, height] = videoSize.split('x');
        const size = `${width}:${height}`;

        const mergeArgs = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', fileListPath,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-vf', `scale=${size}`,
            '-pix_fmt', 'yuv420p',
            finalOutputPath
        ];

        await this.runFFmpegCommand(mergeArgs);
        context.reportProgress(95);

        // 清理临时文件
        await fs.unlink(fileListPath).catch(console.warn);

        return finalOutputPath;
    }

    private async cleanupTemporaryFiles(
        audioAssets: AudioAsset[],
        imageAssets: ImageAsset[],
        subtitleAssets: SubtitleAsset[],
        videoSegments: string[]
    ): Promise<void> {
        console.log("Cleaning up temporary files...");

        const filesToDelete: string[] = [];

        // 收集所有临时文件路径
        audioAssets.forEach(asset => filesToDelete.push(asset.filePath));
        imageAssets.forEach(asset => filesToDelete.push(asset.filePath));
        subtitleAssets.forEach(asset => filesToDelete.push(asset.filePath));
        videoSegments.forEach(segment => filesToDelete.push(segment));

        // 删除文件
        let deletedCount = 0;
        for (const filePath of filesToDelete) {
            try {
                await fs.unlink(filePath);
                deletedCount++;
            } catch (error) {
                console.warn(`Failed to delete temporary file: ${filePath}`, error);
            }
        }

        console.log(`✓ Cleaned up ${deletedCount} temporary files`);
    }
}

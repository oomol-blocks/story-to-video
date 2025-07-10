import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { FFmpegExecutor } from "./FFmpegExcutor";
import { SubtitleAsset } from "./SubtitleGenerator";
import { AudioAsset } from "./AudioGenerator";
import { ImageAsset } from "./ImageGenarator";
import { MediaAsset, VideoConfig } from "./constants";

export interface VideoAsset extends MediaAsset {
    duration: number;
    resolution: string;
}

export interface VideoGeneratorInputs {
    imageAssets: ImageAsset[],
    audioAssets: AudioAsset[],
    subtitleAssets: SubtitleAsset[],
    config: VideoConfig;
    outputDir: string;
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
    // 目前只支持 10s ---> 当前接口只支持 5s、10s。这里直接设置为 10s
    private readonly VIDEO_DURATION = 10;

    private apiKey: string;
    constructor(private context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>) {
        super();
    }

    async generateVideo(
        params: VideoGeneratorInputs,
        segments: Segment[]
    ): Promise<VideoGeneratorOutputs> {
        this.context.reportLog('Generating video segments...', "stdout");

        const { config, outputDir } = params;
        const videoAssets: VideoAsset[] = [];
        const tempVideoFiles: string[] = []; // 收集临时视频文件

        await this.ensureDirectory(outputDir);

        this.apiKey = config.apiKey;

        try {
            // 生成各个视频段
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                this.context.reportLog(`Generating video segment ${i + 1}/${segments.length}`, "stdout");

                const { videoAsset, tempFilePath } = await this.generateSingleVideoSegment(segment, config, outputDir);
                videoAssets.push(videoAsset);
                if (tempFilePath) {
                    tempVideoFiles.push(tempFilePath);
                }

                this.context.reportProgress((i + 1) / segments.length * 80);
            }

            // 合并视频
            this.context.reportLog('Merging video segments...', 'stdout');
            const mergedVideoAsset = await this.mergeVideoSegments(videoAssets, config, outputDir);
            this.context.reportProgress(95);

            // 清理临时文件
            this.context.reportLog('Cleaning up temporary files...', 'stdout');
            await this.cleanupTemporaryFiles(
                params.audioAssets,
                params.imageAssets,
                params.subtitleAssets,
                tempVideoFiles,
                videoAssets // 如果只保留合并后的视频，也可以清理各个视频段
            );
            this.context.reportProgress(100);

            this.context.reportLog('✓ Video generation completed successfully', 'stdout');

            return {
                videoAssets,
                mergedVideoAsset
            };
        } catch (error) {
            // 出错时也要清理临时文件
            this.context.reportLog('Error occurred, cleaning up temporary files...', 'stderr');
            await this.cleanupTemporaryFiles(
                params.audioAssets,
                params.imageAssets,
                params.subtitleAssets,
                tempVideoFiles,
                []
            );
            throw error;
        }
    }

    private async generateSingleVideoSegment(
        segment: Segment,
        config: VideoConfig,
        outputDir: string
    ): Promise<{ videoAsset: VideoAsset; tempFilePath?: string }> {
        const tempFilePath = `${outputDir}/temp_video_${segment.id}.${config.format}`;
        const filePath = `${outputDir}/video_${segment.id}.${config.format}`;

        try {
            // 生成并下载视频段
            const videoUrl = await this.callVideoAPI(segment);
            await this.downloadVideo(videoUrl, tempFilePath);

            // 合成音频和字幕
            await this.compositeVideo(segment, tempFilePath, filePath, config);

            // 获取视频信息
            const videoInfo = await this.getVideoInfo(filePath);

            const videoAsset: VideoAsset = {
                id: segment.id,
                filePath: filePath,
                duration: videoInfo.duration,
                resolution: config.size,
                fileSize: videoInfo.fileSize,
                format: config.format,
                createdAt: new Date()
            };

            return { videoAsset, tempFilePath };
        } catch (error) {
            // 清理当前段的临时文件
            try {
                await fs.unlink(tempFilePath);
            } catch { }
            throw error;
        }
    }

    private async callVideoAPI(segment: Segment): Promise<string> {
        // ... 保持原有的API调用逻辑不变
        try {
            console.log(segment.imageAsset.prompt, segment.audioAsset.timing.duration)
            const prompt = `${segment.imageAsset.prompt} --rs 720p --dur ${this.VIDEO_DURATION}`;

            const content = [
                {
                    type: "text",
                    text: prompt
                },
                {
                    type: "image_url",
                    image_url: {
                        url: segment.imageAsset.filePath
                    },
                    role: "first_frame"
                }
            ];

            if (segment.nextImageAsset) {
                content.push({
                    type: "image_url",
                    image_url: {
                        url: segment.nextImageAsset.filePath
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
                '-t', this.VIDEO_DURATION.toString(),
                '-shortest',
                outputPath
            ];

            await this.runFFmpegCommand(args);
            this.context.reportLog(`✓ Video composite completed: ${outputPath}`, "stdout");
        } catch (error) {
            throw new Error(`Failed to composite video: ${error.message}`);
        }
    }

    private async mergeVideoSegments(
        videoAssets: VideoAsset[],
        config: VideoConfig,
        outputDir: string
    ): Promise<VideoAsset> {
        const mergedPath = `${outputDir}/merged_video.${config.format}`;

        try {
            await this.runFFmpegMerge(videoAssets, mergedPath, config);

            const videoInfo = await this.getVideoInfo(mergedPath);

            return {
                id: 'merged',
                filePath: mergedPath,
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

    /**
     * 清理临时文件
     */
    private async cleanupTemporaryFiles(
        audioAssets: AudioAsset[],
        imageAssets: ImageAsset[],
        subtitleAssets: SubtitleAsset[],
        tempVideoFiles: string[],
        videoSegments: VideoAsset[] = [] // 可选：如果只保留合并视频，可以删除各个视频段
    ): Promise<void> {
        this.context.reportLog("Starting cleanup of temporary files...", "stdout");

        const filesToDelete: string[] = [];
        const fileCategories = {
            audio: audioAssets.map(asset => asset.filePath),
            images: imageAssets.map(asset => asset.filePath),
            subtitles: subtitleAssets.map(asset => asset.filePath),
            tempVideos: tempVideoFiles,
            videoSegments: videoSegments.map(asset => asset.filePath)
        };

        // 收集所有需要删除的文件
        Object.entries(fileCategories).forEach(([category, files]) => {
            if (files.length > 0) {
                this.context.reportLog(`Found ${files.length} ${category} files to cleanup`, "stdout");
                filesToDelete.push(...files);
            }
        });

        // 删除文件并统计结果
        let deletedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const filePath of filesToDelete) {
            try {
                // 检查文件是否存在
                await fs.access(filePath);
                await fs.unlink(filePath);
                deletedCount++;
                this.context.reportLog(`✓ Deleted: ${path.basename(filePath)}`, "stdout");
            } catch (error) {
                errorCount++;
                const errorMsg = `✗ Failed to delete: ${path.basename(filePath)} - ${error.message}`;
                errors.push(errorMsg);
                this.context.reportLog(errorMsg, "stderr");
            }
        }

        // 输出清理摘要
        const summary = `Cleanup completed: ${deletedCount} files deleted, ${errorCount} errors`;
        this.context.reportLog(summary, errorCount > 0 ? "stderr" : "stdout");

        if (errorCount > 0) {
            this.context.reportLog("Cleanup errors details:", "stderr");
            errors.forEach(error => this.context.reportLog(error, "stderr"));
        }
    }

    /**
     * 清理输出目录中的特定类型文件
     */
    private async cleanupDirectoryByPattern(
        outputDir: string,
        patterns: string[],
        description: string
    ): Promise<void> {
        this.context.reportLog(`Cleaning up ${description} in directory: ${outputDir}`, "stdout");

        try {
            const files = await fs.readdir(outputDir);
            const matchingFiles = files.filter(file =>
                patterns.some(pattern => {
                    const regex = new RegExp(pattern, 'i');
                    return regex.test(file);
                })
            );

            let deletedCount = 0;
            for (const file of matchingFiles) {
                try {
                    const filePath = path.join(outputDir, file);
                    await fs.unlink(filePath);
                    deletedCount++;
                    this.context.reportLog(`✓ Deleted: ${file}`, "stdout");
                } catch (error) {
                    this.context.reportLog(`✗ Failed to delete: ${file} - ${error.message}`, "stderr");
                }
            }

            this.context.reportLog(`✓ Cleaned up ${deletedCount} ${description} files`, "stdout");
        } catch (error) {
            this.context.reportLog(`Failed to cleanup ${description} in ${outputDir}: ${error.message}`, "stderr");
        }
    }

    // ... 其他原有方法保持不变
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

    private async ensureDirectory(dir: string) {
        return await fs.mkdir(dir, { recursive: true });
    }
}

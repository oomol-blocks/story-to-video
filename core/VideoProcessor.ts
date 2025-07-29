import type { Context } from "@oomol/types/oocana";
import fs from "fs/promises";
import { FFmpegExecutor } from "./FFmpegExcutor";
import { VideoAsset } from "./VideoGenerator";
import { VideoConfig } from "../utils/constants";
import { AudioAsset } from "./AudioGenerator";
import { SubtitleAsset } from "./SubtitleGenerator";

export interface VideoProcessorInputs {
    videoAssets: VideoAsset[]; // 视频段
    audioAssets?: AudioAsset[]; // 可能的音频资源
    subtitleAssets?: SubtitleAsset[]; // 可能的字幕资源
    config: VideoConfig;
    outputDir: string;
}

export interface VideoProcessorOutputs {
    mergedVideoAsset: VideoAsset;
}

export interface SourceItem {
    id: string;
    duration: number;
    audioAsset?: AudioAsset;
    subtitleAsset?: SubtitleAsset;
}

export class VideoProcessor extends FFmpegExecutor {
    constructor(private context: Context<VideoProcessorInputs, VideoProcessorOutputs>) {
        super();
    }

    /**
     * 合并视频段和资源到指定路径
     * @param rawVideoAsset 视频段
     * @param segment 需要合并的资源
     * @param config 目标视频配置
     * @param outputPath 输出路径
     * @returns 
     */
    async processVideoSource(
        rawVideoAsset: VideoAsset,
        source: SourceItem,
        config: VideoConfig,
        outputPath: string
    ): Promise<VideoAsset> {
        this.context.reportLog(`Processing video segment with audio and subtitles`, "stdout");

        try {
            await fs.access(rawVideoAsset.filePath);

            const hasAudio = source.audioAsset && source.audioAsset.filePath;
            const hasSubtitle = source.subtitleAsset && source.subtitleAsset.filePath;

            if (hasAudio) {
                await fs.access(source.audioAsset.filePath);
            }
            if (hasSubtitle) {
                await fs.access(source.subtitleAsset.filePath);
            }

            if (hasAudio || hasSubtitle) {
                // 需要进行合成处理
                await this.compositeVideo(rawVideoAsset.filePath, source, outputPath, config);
            } else {
                // 没有音频和字幕，直接复制原始视频并调整分辨率
                await this.processVideoOnly(rawVideoAsset.filePath, source, outputPath, config);
            }

            const videoInfo = await this.getVideoInfo(outputPath);

            return {
                id: source.id,
                filePath: outputPath,
                duration: videoInfo.duration,
                resolution: config.size,
                fileSize: videoInfo.fileSize,
                format: config.format || "mp4",
                createdAt: new Date()
            };;
        } catch (error) {
            throw new Error(`Failed to process video segment: ${error.message}`);
        }
    }

    /**
     * 合成音频和字幕到视频中
     */
    private async compositeVideo(
        inputVideoPath: string,
        source: SourceItem,
        outputPath: string,
        config: VideoConfig
    ): Promise<void> {
        const resolution = config.size.replace('x', ':');
        const hasAudio = Boolean(source.audioAsset?.filePath);
        const hasSubtitle = Boolean(source.subtitleAsset?.filePath);

        const inputs = ['-y', '-i', inputVideoPath];

        if (hasAudio) {
            inputs.push('-i', source.audioAsset!.filePath);
        }

        let videoFilter = `scale=${resolution}`;
        if (hasSubtitle) {
            const subtitlePath = source.subtitleAsset!.filePath.replace(/'/g, "\\'");
            videoFilter = `subtitles='${subtitlePath}',${videoFilter}`;
        }

        const args = [
            ...inputs,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-vf', videoFilter
        ];

        if (hasAudio) {
            args.push(
                '-c:a', 'aac',
                '-b:a', '128k',
                '-t', Math.ceil(source.audioAsset!.timing.duration).toString(),
                '-shortest'
            );
        } else {
            // 没有音频时，使用 segment.duration 控制时长
            args.push(
                '-an', // 禁用音频
                '-t', source.duration.toString()
            );
        }

        args.push(outputPath);

        await this.runFFmpegCommand(args);

        // 创建日志输出到控制台
        const processingInfo = [];
        if (hasAudio) processingInfo.push('audio');
        if (hasSubtitle) processingInfo.push('subtitles');
        
        this.context.reportLog(
            `✓ Video segment processing completed with ${processingInfo.join(' and ')}: ${outputPath}`, 
            "stdout"
        );
    }

    // 调整分辨率和时长
    private async processVideoOnly(
        inputVideoPath: string,
        source: SourceItem,
        outputPath: string,
        config: VideoConfig
    ): Promise<void> {
        const resolution = config.size.replace('x', ':');

        const args = [
            '-y',
            '-i', inputVideoPath,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-vf', `scale=${resolution}`,
            '-an', // 禁用音频
            '-t', source.duration.toString(),
            outputPath
        ];

        await this.runFFmpegCommand(args);
        this.context.reportLog(`✓ Video segment processing completed (video only): ${outputPath}`, "stdout");
    }

    // 合并多个视频段
    async mergeVideoSources(
        videoAssets: VideoAsset[],
        config: VideoConfig,
        outputPath: string,
        fileListPath: string
    ): Promise<VideoAsset> {
        this.context.reportLog('Merging video segments...', 'stdout');

        try {
            await this.runFFmpegMerge(videoAssets, outputPath, config, fileListPath);

            const videoInfo = await this.getVideoInfo(outputPath);

            return {
                id: 'merged',
                filePath: outputPath,
                duration: videoInfo.duration,
                resolution: config.size,
                fileSize: videoInfo.fileSize,
                format: config.format || "mp4",
                createdAt: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to merge video segments: ${error.message}`);
        }
    }

    private async runFFmpegMerge(
        videoAssets: VideoAsset[],
        outputPath: string,
        config: VideoConfig,
        providedFileListPath: string
    ): Promise<void> {
        if (videoAssets.length === 0) {
            throw new Error('No video assets to merge');
        }

        if (videoAssets.length === 1) {
            await fs.copyFile(videoAssets[0].filePath, outputPath);
            return;
        }

        const fileListContent = videoAssets.map(asset => `file '${asset.filePath}'`).join('\n');
        await fs.writeFile(providedFileListPath, fileListContent, 'utf8');

        try {
            const resolution = config.size.replace('x', ':');

            const mergeArgs = [
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', providedFileListPath,
                '-c:v', "libx264",
                '-c:a', 'aac',
                '-vf', `scale=${resolution}`,
                '-pix_fmt', 'yuv420p',
                outputPath
            ];

            await this.runFFmpegCommand(mergeArgs);

            this.context.reportLog(`✓ Video merge completed: ${outputPath}`, "stdout");
        } catch (error) {
            throw error;
        }
    }
}

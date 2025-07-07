import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { FFmpegExecutor } from "./FFmpegExcutor";
import { SubtitleAsset } from "./SubtitleGenerator";
import { AudioAsset } from "./AudioGenerator";
import { ImageAsset } from "./ImageGenarator";
import { ScriptScene } from "./ScriptParser";
import { getVideoParamsFromImageSize, VideoParams, VideoSize, VideoSizeType } from "./constants";

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
}

export interface VideoGeneratorOutputs {
    videoAsset: VideoAsset;
}

export class VideoGenerator extends FFmpegExecutor {
    async generateVideo(
        params: VideoGeneratorInputs,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>
    ): Promise<VideoGeneratorOutputs> {
        console.log("Starting video generation...");
        context.reportProgress(0);

        const startTime = Date.now();
        const { scenes, audioAssets, imageAssets, subtitleAssets, outputDir, videoSize } = params;

        console.log(scenes, audioAssets, imageAssets, subtitleAssets)
        const videoSegments: string[] = [];

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        // 计算总时长用于进度计算
        this.totalDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);

        // 确定视频参数
        let finalVideoParams: VideoParams;
        let finalResolution: string;

        if (videoSize) {
            // 如果手动指定了视频尺寸，使用指定的尺寸
            finalVideoParams = getVideoParamsFromImageSize(videoSize);
            finalResolution = videoSize;
        } else {
            // 否则根据第一张图片的尺寸自动选择
            const firstImageAsset = imageAssets[0];
            if (!firstImageAsset) {
                throw new Error('No image assets found');
            }
            finalVideoParams = getVideoParamsFromImageSize(firstImageAsset.resolution);
            finalResolution = finalVideoParams.resolution;
        }

        console.log(`Using video resolution: ${finalResolution}`);
        console.log(`Video parameters:`, finalVideoParams);

        // 为每个场景生成视频片段
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const audioAsset = audioAssets.find(asset => asset.sceneId === scene.id);
            const imageAsset = imageAssets.find(asset => asset.sceneId === scene.id);
            const subtitleAsset = subtitleAssets.find(asset => asset.sceneId === scene.id);

            if (!audioAsset || !imageAsset || !subtitleAsset) {
                console.warn(`Missing assets for scene ${scene.id}, skipping`);
                continue;
            }

            console.log(`Generating video segment for scene ${scene.id}`);

            // 验证输入文件
            try {
                await fs.access(audioAsset.filePath);
                await fs.access(imageAsset.filePath);
                await fs.access(subtitleAsset.filePath);
            } catch (error) {
                console.error(`Missing input files for scene ${scene.id}:`, error);
                continue;
            }

            const segmentOutput = path.join(outputDir, `segment_${scene.id}.mp4`);
            videoSegments.push(segmentOutput);

            // 生成视频片段 - 使用动态参数
            const args = await this.buildFFmpegArgs(
                imageAsset.filePath,
                audioAsset.filePath,
                subtitleAsset.filePath,
                segmentOutput,
                audioAsset.duration,
                finalVideoParams
            );

            await this.runFFmpegCommand(args);

            const progress = ((i + 1) / scenes.length) * 80; // 80% 用于片段生成
            context.reportProgress(progress);

            console.log(`✓ Generated video segment for scene ${scene.id}`);
        }

        if (videoSegments.length === 0) {
            throw new Error('No video segments were generated');
        }

        // 合并视频片段
        const fileListPath = path.join(outputDir, 'filelist.txt');
        const fileListContent = videoSegments.map(segment => `file '${segment}'`).join('\n');
        await fs.writeFile(fileListPath, fileListContent, 'utf8');

        const finalOutputPath = path.join(outputDir, 'final_video.mp4');
        console.log("Merging video segments...");

        context.reportProgress(85);

        const mergeArgs = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', fileListPath,
            '-c', 'copy',
            finalOutputPath
        ];

        await this.runFFmpegCommand(mergeArgs);

        context.reportProgress(100);

        const stats = await fs.stat(finalOutputPath);
        const processingTime = Date.now() - startTime;
        const totalDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);

        console.log(`✓ Video generation completed in ${processingTime}ms`);

        return {
            videoAsset: {
                filePath: finalOutputPath,
                duration: totalDuration,
                resolution: "1024x1792",
                fileSize: stats.size
            }
        };
    }

    private async buildFFmpegArgs(
        imagePath: string,
        audioPath: string,
        subtitlePath: string,
        outputPath: string,
        duration: number,
        videoParams: VideoParams
    ): Promise<string[]> {
        // 构建视频滤镜
        const videoFilters = [];
        
        // 添加缩放滤镜
        if (videoParams.scaleFilter) {
            videoFilters.push(videoParams.scaleFilter);
        }
        
        // 添加字幕滤镜
        videoFilters.push(`subtitles='${subtitlePath.replace(/'/g, "\\'")}'`);
        
        const videoFilterString = videoFilters.join(',');

        const args = [
            '-y',
            '-loop', '1',
            '-i', imagePath,
            '-i', audioPath,
            '-c:v', 'libx264',
            '-preset', videoParams.preset,
            '-crf', videoParams.crf.toString(),
            '-c:a', 'aac',
            '-b:a', '128k',
            '-b:v', videoParams.bitrate,
            '-pix_fmt', 'yuv420p',
            '-r', videoParams.framerate.toString(),
            '-vf', videoFilterString,
            '-t', duration.toString(),
            '-shortest',
            outputPath
        ];

        return args;
    }

    public getRecommendedVideoSize(imageAssets: ImageAsset[]): string {
        if (imageAssets.length === 0) {
            return VideoSize.PORTRAIT; // 默认竖屏
        }

        // 统计不同尺寸的图片数量
        const sizeCount = imageAssets.reduce((acc, asset) => {
            acc[asset.resolution] = (acc[asset.resolution] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // 选择出现频率最高的尺寸
        const mostCommonSize = Object.entries(sizeCount)
            .sort(([, a], [, b]) => b - a)[0][0];

        const videoParams = getVideoParamsFromImageSize(mostCommonSize);
        return videoParams.resolution;
    }
}

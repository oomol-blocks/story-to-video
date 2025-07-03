import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { FFmpegExecutor } from "./FFmpegExcutor";
import { SubtitleAsset } from "./SubtitleGenerator";
import { AudioAsset } from "./AudioGenerator";
import { ImageAsset } from "./ImageGenarator";
import { ScriptScene } from "./ScriptParser";

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
        const { scenes, audioAssets, imageAssets, subtitleAssets, outputDir } = params;
        const videoSegments: string[] = [];

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        // 计算总时长用于进度计算
        this.totalDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);

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

            // 生成视频片段
            const args = [
                '-y',
                '-loop', '1',
                '-i', imageAsset.filePath,
                '-i', audioAsset.filePath,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-pix_fmt', 'yuv420p',
                '-r', '25',
                '-vf', [
                    'scale=1080:1080:force_original_aspect_ratio=decrease',
                    'pad=1080:1920:-1:-1:color=black',
                    `subtitles='${subtitleAsset.filePath.replace(/'/g, "\\'")}':force_style='FontName=SimHei,FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'`
                ].join(','),
                '-t', audioAsset.duration.toString(),
                '-shortest',
                segmentOutput
            ];

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
                resolution: "1080x1920",
                fileSize: stats.size
            }
        };
    }
}

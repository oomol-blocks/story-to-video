import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises"
import path from 'path';

import { AudioAsset } from "./AudioGenerator"
import { ScriptScene } from "./ScriptParser";

export interface SubtitleAsset {
    sceneId: number;
    filePath: string;
    content: string;
    startTime: number;
    endTime: number;
}

export interface SubtitleGeneratorInputs {
    scenes: ScriptScene[];
    audioAssets: AudioAsset[];
    outputDir: string;
}

export interface SubtitleGeneratorOutputs {
    subtitleAssets: SubtitleAsset[];
}

export class SubtitleGenerator {
    async generateSubtitles(
        params: SubtitleGeneratorInputs,
        context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>
    ): Promise<SubtitleGeneratorOutputs> {
        console.log("Starting subtitle generation...");
        context.reportProgress(0);

        const { scenes, audioAssets, outputDir } = params;
        const subtitleAssets: SubtitleAsset[] = [];

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        let currentTime = 0;
        const srtEntries: string[] = [];

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const audioAsset = audioAssets.find(asset => asset.sceneId === scene.id);

            if (!audioAsset) {
                console.warn(`No audio asset found for scene ${scene.id}, skipping`);
                continue;
            }

            console.log(`Generating subtitle for scene ${scene.id}`);

            const startTime = currentTime;
            const endTime = currentTime + audioAsset.duration;

            // 创建单独的字幕文件
            const subtitleFile = path.join(outputDir, `subtitle_${scene.id}.srt`);
            const singleSrtContent = `1\n00:00:00,000 --> ${this.formatSRTTime(audioAsset.duration)}\n${audioAsset.transcript}\n`;
            await fs.writeFile(subtitleFile, singleSrtContent, 'utf8');

            subtitleAssets.push({
                sceneId: scene.id,
                filePath: subtitleFile,
                content: audioAsset.transcript,
                startTime,
                endTime
            });

            // 为合并文件准备内容
            const srtEntry = `${i + 1}\n${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n${audioAsset.transcript}\n`;
            srtEntries.push(srtEntry);

            currentTime = endTime;

            const progress = ((i + 1) / scenes.length) * 100;
            context.reportProgress(progress);

            console.log(`✓ Generated subtitle for scene ${scene.id}`);
        }
        return { subtitleAssets };
    }

    private formatSRTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
    }
}

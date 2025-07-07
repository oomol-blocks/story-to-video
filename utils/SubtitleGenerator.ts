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
    private readonly maxLineLength = 13; // 每行的最大字符数

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

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const audioAsset = audioAssets.find(asset => asset.sceneId === scene.id);

            if (!audioAsset) {
                console.warn(`No audio asset found for scene ${scene.id}, skipping`);
                continue;
            }

            console.log(`Generating subtitle for scene ${scene.id}`);

            // 创建单独的 ASS 字幕文件
            const subtitleFile = path.join(outputDir, `subtitle_${scene.id}.ass`);
            const assContent = this.generateAssContent(audioAsset);
            await fs.writeFile(subtitleFile, assContent, 'utf8');

            subtitleAssets.push({
                sceneId: scene.id,
                filePath: subtitleFile,
                content: audioAsset.sentences ? audioAsset.sentences.join(' ') : audioAsset.transcript,
                startTime: 0,
                endTime: audioAsset.duration
            });

            const progress = ((i + 1) / scenes.length) * 100;
            context.reportProgress(progress);

            console.log(`✓ Generated subtitle for scene ${scene.id}`);
        }
        return { subtitleAssets };
    }

    private generateAssContent(audioAsset: AudioAsset): string {
        const assHeader = this.generateAssHeader();
        const assEvents = this.generateAssEvents(audioAsset);

        return assHeader + assEvents;
    }

    private generateAssHeader(): string {
        return `[Script Info]
Title: Generated ASS
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,18,&Hffffff,&Hffffff,&H000000,&H000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,130,1
WrapStyle: 0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    }

    private generateAssEvents(audioAsset: AudioAsset): string {
        let assEvents = '';

        // 如果有 sentences 字段，使用它；否则使用 transcript
        const sentences = audioAsset.sentences || [audioAsset.transcript];

        if (sentences.length === 0) {
            return assEvents;
        }

        // 计算每个句子的时间分配
        const totalDuration = audioAsset.duration;
        const sentenceDuration = totalDuration / sentences.length;

        let currentTime = 0;

        for (const sentence of sentences) {
            const startTime = this.formatAssTime(currentTime);
            const endTime = this.formatAssTime(currentTime + sentenceDuration);

            // 处理长句子，按最大字符数分行
            const formattedText = this.formatTextWithLineBreaks(sentence.trim());

            assEvents += `narration: 0,${startTime},${endTime},Default,,20,20,45,,${formattedText}\n`;

            currentTime += sentenceDuration;
        }

        return assEvents;
    }

    private formatTextWithLineBreaks(text: string): string {
        const result = [];
        for (let i = 0; i < text.length; i += this.maxLineLength) {
            result.push(text.slice(i, i + this.maxLineLength));
        }
        return result.join('\\N');
    }

    private formatAssTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const centiseconds = Math.floor((seconds % 1) * 100);

        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
}

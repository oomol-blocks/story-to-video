import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises"

import { MediaAsset, SubtitleConfig, TimingInfo } from "./constants";

export interface SubtitleAsset extends MediaAsset {
    content: string;
    duration: number;
    language: string;
    encoding: string;
}

export interface SubtitleGeneratorInputs {
    texts: Array<{
        id: string;
        content: string;
        sentences?: string[];
        timing: TimingInfo;
    }>;
    outputDir: string;
}

export interface SubtitleGeneratorOutputs {
    subtitleAssets: SubtitleAsset[];
}

export class SubtitleGenerator {
    private readonly maxLineLength = 12; // 每行的最大字符数

    constructor(private context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>) { }

    async generateSubtitles(
        params: SubtitleGeneratorInputs,
        config: SubtitleConfig
    ): Promise<SubtitleGeneratorOutputs> {
        this.context.reportLog('Generating subtitles...', "stdout");

        const { texts, outputDir } = params;
        const subtitleAssets: SubtitleAsset[] = [];

        await this.ensureDirectory(outputDir);

        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            this.context.reportLog(`Generating subtitle ${i + 1}/${texts.length}`, "stdout");

            const subtitleAsset = await this.generateSingleSubtitle(text, config, outputDir);
            subtitleAssets.push(subtitleAsset);

            this.context.reportProgress((i + 1) / texts.length * 100);
        }

        return { subtitleAssets };
    }

    async generateSingleSubtitle(
        text: { id: string; content: string; sentences?: string[]; timing: TimingInfo },
        config: SubtitleConfig,
        outputPath: string
    ): Promise<SubtitleAsset> {
        // 根据格式生成字幕文件
        const subtitleContent = await this.generateSubtitleContent(text, config);
        await this.writeSubtitleFile(outputPath, subtitleContent, config.encoding);

        const fileSize = await this.getFileSize(outputPath);

        return {
            id: text.id,
            filePath: outputPath,
            content: text.content,
            duration: text.timing.duration,
            language: config.language,
            encoding: config.encoding,
            fileSize,
            format: config.format,
            createdAt: new Date()
        };
    }

    private async generateSubtitleContent(
        text: { id: string; content: string; sentences?: string[]; timing: TimingInfo; },
        config: SubtitleConfig
    ): Promise<string> {
        // 根据格式生成字幕内容
        switch (config.format) {
            case 'srt':
                return this.generateSRT(text);
            case 'ass':
                return this.generateASS(text);
            case 'vtt':
                return this.generateVTT(text);
            default:
                throw new Error(`Unsupported subtitle format: ${config.format}`);
        }
    }

    private generateSRT(text: { content: string; sentences?: string[]; timing: TimingInfo; }): string {
        // 如果有 sentences，按句子分段；否则使用整体内容
        if (text.sentences && text.sentences.length > 0) {
            return this.generateSRTWithSentences(text.sentences, text.timing);
        } else {
            return this.generateSRTSingle(text.content, text.timing);
        }
    }

    private generateSRTWithSentences(sentences: string[], timing: TimingInfo): string {
        const duration = timing.duration;
        const sentenceDuration = duration / sentences.length;
        let srtContent = '';
        let currentTime = 0; // 从0开始

        for (let i = 0; i < sentences.length; i++) {
            const endTime = currentTime + sentenceDuration;
            const formattedText = this.formatTextWithLineBreaks(sentences[i].trim());

            srtContent += `${i + 1}
${this.formatSRTTime(currentTime)} --> ${this.formatSRTTime(endTime)}
${formattedText.replace(/\\N/g, '\n')}

`;
            currentTime = endTime;
        }

        return srtContent;
    }

    private generateSRTSingle(content: string, timing: TimingInfo): string {
        const duration = timing.duration;
        const formattedText = this.formatTextWithLineBreaks(content);

        return `1
${this.formatSRTTime(0)} --> ${this.formatSRTTime(duration)}
${formattedText.replace(/\\N/g, '\n')}

`;
    }

    private generateASS(text: { content: string; sentences?: string[]; timing: TimingInfo }): string {
        const assHeader = this.generateAssHeader();

        // 如果有 sentences，按句子分段；否则使用整体内容
        let assEvents: string;
        if (text.sentences && text.sentences.length > 0) {
            assEvents = this.generateAssEventsWithSentences(text.sentences, text.timing);
        } else {
            assEvents = this.generateAssEventsSingle(text.content, text.timing);
        }

        return assHeader + assEvents;
    }

    private generateAssEventsWithSentences(sentences: string[], timing: TimingInfo): string {
        // 对于视频段，每个段落都应该从 0 开始
        const duration = timing.duration;
        const sentenceDuration = duration / sentences.length;
        let assEvents = '';
        let currentTime = 0; // 从 0 开始

        for (const sentence of sentences) {
            const endTime = currentTime + sentenceDuration;
            const startTimeFormatted = this.formatAssTime(currentTime);
            const endTimeFormatted = this.formatAssTime(endTime);
            const formattedText = this.formatTextWithLineBreaks(sentence.trim());

            assEvents += `Dialogue: 0,${startTimeFormatted},${endTimeFormatted},Default,,20,20,40,,${formattedText}\n`;
            currentTime = endTime;
        }

        return `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assEvents}`;
    }

    private generateAssEventsSingle(content: string, timing: TimingInfo): string {
        // 对于视频段，每个段落都应该从 0 开始
        const duration = timing.duration;
        const startTimeFormatted = this.formatAssTime(0); // 从 0 开始
        const endTimeFormatted = this.formatAssTime(duration); // 到 duration 结束
        const formattedText = this.formatTextWithLineBreaks(content);

        return `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${startTimeFormatted},${endTimeFormatted},Default,,20,20,40,,${formattedText}
`;
    }

    private generateVTT(text: { content: string; sentences?: string[]; timing: TimingInfo }): string {
        // 如果有 sentences，按句子分段；否则使用整体内容
        if (text.sentences && text.sentences.length > 0) {
            return this.generateVTTWithSentences(text.sentences, text.timing);
        } else {
            return this.generateVTTSingle(text.content, text.timing);
        }
    }

    private generateVTTWithSentences(sentences: string[], timing: TimingInfo): string {
        const duration = timing.duration;
        const sentenceDuration = duration / sentences.length;
        let vttContent = 'WEBVTT\n\n';
        let currentTime = 0; // 从 0 开始

        for (const sentence of sentences) {
            const endTime = currentTime + sentenceDuration;
            const formattedText = this.formatTextWithLineBreaks(sentence.trim());

            vttContent += `${this.formatVTTTime(currentTime)} --> ${this.formatVTTTime(endTime)}
${formattedText.replace(/\\N/g, '\n')}

`;
            currentTime = endTime;
        }

        return vttContent;
    }

    private generateVTTSingle(content: string, timing: TimingInfo): string {
        const duration = timing.duration;
        const formattedText = this.formatTextWithLineBreaks(content);

        return `WEBVTT

${this.formatVTTTime(0)} --> ${this.formatVTTTime(duration)}
${formattedText.replace(/\\N/g, '\n')}

`;
    }

    // 根据不同的屏幕尺寸调整字幕位置及字体大小
    private generateAssHeader(): string {
        return `[Script Info]
Title: Generated ASS
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,14,&Hffffff,&Hffffff,&H000000,&H000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,130,1
WrapStyle: 0

`;
    }

    private formatTextWithLineBreaks(text: string): string {
        const result = [];
        for (let i = 0; i < text.length; i += this.maxLineLength) {
            result.push(text.slice(i, i + this.maxLineLength));
        }
        return result.join('\\N');
    }

    private formatSRTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
    }

    private formatVTTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }

    private formatAssTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const centiseconds = Math.floor((seconds % 1) * 100);

        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }

    private async writeSubtitleFile(filePath: string, content: string, encoding: string): Promise<void> {
        try {
            await fs.writeFile(filePath, content, { encoding: encoding as BufferEncoding });
        } catch (error) {
            throw new Error(`Failed to write subtitle file ${filePath}: ${error.message}`);
        }
    }

    private async getFileSize(filePath: string): Promise<number> {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            throw new Error(`Failed to get file size for ${filePath}: ${error.message}`);
        }
    }

    private async ensureDirectory(dir: string): Promise<void> {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create directory ${dir}: ${error}`);
        }
    }
}

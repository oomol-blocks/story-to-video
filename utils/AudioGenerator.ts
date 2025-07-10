import { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";

import { AudioConfig, MediaAsset, TimingInfo } from "./constants";
import { FFmpegExecutor } from "./FFmpegExcutor";

export interface AudioAsset extends MediaAsset {
    id: string;
    timing: TimingInfo;
    transcript: string;
    sentences?: string[];
}

export interface AudioGeneratorInputs {
    texts: Array<{
        id: string;
        content: string;
    }>;
    config: AudioConfig;
    outputDir: string;
}

export interface AudioGeneratorOutputs {
    audioAssets: AudioAsset[];
    totalDuration: number;
}

export class AudioGenerator extends FFmpegExecutor {
    constructor(
        private context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>
    ) {
        super();
    }

    async generateAudio(
        params: AudioGeneratorInputs
    ): Promise<AudioGeneratorOutputs> {
        this.context.reportLog('Generating audio files...', "stdout");

        const { texts, config, outputDir } = params;
        const audioAssets: AudioAsset[] = [];

        // 确保输出目录存在
        await this.ensureDirectory(outputDir);

        // 用于计算累积时间
        let currentStartTime = 0;

        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            this.context.reportLog(`Generating audio for text ${i + 1}/${texts.length}`, "stdout");

            try {
                const audioAsset = await this.generateSingleAudio(text, config, outputDir, currentStartTime);
                audioAssets.push(audioAsset);

                currentStartTime = audioAsset.timing.endTime;
            } catch (error) {
                this.context.reportLog(`Failed to generate audio for text ${text.id}: ${error}`, "stderr");
                throw error;
            }

            await this.context.reportProgress((i + 1) / texts.length * 100);
        }

        const totalDuration = audioAssets.reduce((sum, asset) => sum + asset.timing.duration, 0);

        this.context.reportLog(`Audio generation completed. Total duration: ${totalDuration.toFixed(2)}s`, "stdout");
        return { audioAssets, totalDuration };
    }

    private async generateSingleAudio(
        text: { id: string; content: string; },
        config: AudioConfig,
        outputDir: string,
        startTime: number
    ): Promise<AudioAsset> {
        const filePath = `${outputDir}/audio_${text.id}.${config.format}`;

        await this.callAudioAPI(text.content, config, filePath);

        const audioInfo = await this.getAudioInfo(filePath);

        const timing: TimingInfo = {
            startTime: startTime,
            endTime: startTime + audioInfo.duration,
            duration: audioInfo.duration
        };

        return {
            id: text.id,
            filePath,
            timing,
            transcript: text.content,
            fileSize: audioInfo.fileSize,
            format: config.format,
            createdAt: new Date()
        };
    }

    private async callAudioAPI(
        text: string,
        config: AudioConfig,
        outputPath: string
    ): Promise<void> {
        const requestFormat = config.requestFormat || 'json';
        let body: string | URLSearchParams;
        let headers: Record<string, string>;

        if (requestFormat === 'json') {
            // JSON 格式请求
            const requestBody = {
                model: config.model,
                input: text,
                voice: config.voice || "alloy",
                response_format: config.format || "mp3",
                speed: config.speed || 1
            };

            body = JSON.stringify(requestBody);
            headers = {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            };
        } else {
            // Form 格式请求
            const urlencoded = new URLSearchParams();
            urlencoded.append("model", config.model);
            urlencoded.append("input", text);
            urlencoded.append("voice", config.voice || "alloy");
            urlencoded.append("response_format", config.format || "mp3");
            urlencoded.append("speed", config.speed?.toString() || "1");

            body = urlencoded;
            headers = {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            };
        }

        const response = await fetch(config.apiEndpoint, {
            method: 'POST',
            body,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`TTS API failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        await fs.writeFile(outputPath, Buffer.from(audioBuffer));
    }

    private async ensureDirectory(dir: string): Promise<void> {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create directory ${dir}: ${error}`);
        }
    }
}

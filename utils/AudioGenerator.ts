import { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from "node:path";

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
    outputDir?: string;
}

export interface AudioGeneratorOutputs {
    audioAssets: AudioAsset[];
}

export class AudioGenerator extends FFmpegExecutor {
    constructor(
        private context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>
    ) {
        super();
    }

    async generateAudio(
        text: { id: string; content: string; },
        config: AudioConfig,
        outputPath: string,
        startTime: number
    ): Promise<AudioAsset> {
        this.context.reportLog(`Generating audio for text: ${text.content}`, "stdout");

        // 调用API生成音频
        await this.callAudioAPI(text.content, config, outputPath);

        // 获取音频信息
        const audioInfo = await this.getAudioInfo(outputPath);

        // 构建时间信息
        const timing: TimingInfo = {
            startTime: startTime,
            endTime: startTime + audioInfo.duration,
            duration: audioInfo.duration
        };

        return {
            id: text.id,
            filePath: outputPath,
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

        try {
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
        } catch (e) {
            throw new Error(`TTS API failed: ${e.message}`);
        }
    }
}

import { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';
import * as ffmpeg from "@ffmpeg-installer/ffmpeg";
import { spawn } from 'child_process';

import { ScriptScene } from "./ScriptParser";

export interface AudioAsset {
    sceneId: number;
    filePath: string;
    duration: number;
    transcript: string;
}

export interface AudioGeneratorInputs {
    scenes: ScriptScene[];
    API_KEY: string;
    outputDir: string;
}

export interface AudioGeneratorOutputs {
    audioAssets: AudioAsset[];
}

export class AudioGenerator {
    async generateAudio(
        params: AudioGeneratorInputs,
        context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>
    ): Promise<AudioGeneratorOutputs> {
        console.log("Starting audio generation...");
        context.reportProgress(0);

        const { scenes, API_KEY, outputDir } = params;
        const audioAssets: AudioAsset[] = [];

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            console.log(`Generating audio for scene ${scene.id}: ${scene.description}`);

            try {
                const audioFile = await this.generateSingleAudio(
                    scene.dialogue,
                    scene.id,
                    API_KEY,
                    outputDir
                );

                // 获取实际音频时长
                const actualDuration = await this.getAudioDuration(audioFile);

                audioAssets.push({
                    sceneId: scene.id,
                    filePath: audioFile,
                    duration: actualDuration,
                    transcript: scene.dialogue
                });

                const progress = ((i + 1) / scenes.length) * 100;
                context.reportProgress(progress);

                console.log(`✓ Generated audio for scene ${scene.id}`);
            } catch (error) {
                console.error(`Failed to generate audio for scene ${scene.id}:`, error);
                throw error;
            }
        }

        const totalDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);

        console.log(`✓ Generated ${audioAssets.length} audio files, total duration: ${totalDuration}s`);

        return { audioAssets };
    }

    private async generateSingleAudio(
        text: string,
        sceneId: number,
        apiKey: string,
        outputDir: string
    ): Promise<string> {
        const audioFile = path.join(outputDir, `audio_${sceneId}.mp3`);

        const urlencoded = new URLSearchParams();
        urlencoded.append("model", "tts-1");
        urlencoded.append("input", text);
        urlencoded.append("voice", "alloy");
        urlencoded.append("response_format", "mp3");
        urlencoded.append("speed", "1");

        const response = await fetch("https://cn2us02.opapi.win/v1/audio/speech", {
            method: 'POST',
            body: urlencoded,
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`TTS API failed: ${response.status} ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        await fs.writeFile(audioFile, Buffer.from(audioBuffer));

        return audioFile;
    }

    private async getAudioDuration(audioPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const args = ['-i', audioPath, '-f', 'null', '-'];
            const process = spawn(ffmpeg.path, args);
            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', () => {
                const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                if (durationMatch) {
                    const hours = parseInt(durationMatch[1]);
                    const minutes = parseInt(durationMatch[2]);
                    const seconds = parseFloat(durationMatch[3]);
                    resolve(hours * 3600 + minutes * 60 + seconds);
                } else {
                    reject(new Error('Could not parse audio duration'));
                }
            });

            process.on('error', reject);
        });
    }
}

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Context } from "@oomol/types/oocana";
import { FFmpegExecutor } from "./FFmpegExcutor";
import { AudioAsset } from "./AudioGenerator";

export interface AudioExtenderOptions {
    inputPath: string;
    outputPath: string;
    currentDuration: number;
    targetDuration: number;
}

export interface AudioExtenderInputs {
    audioAssets: AudioAsset[];
    targetDuration: number;
}

export interface AudioExtenderOutputs {
    audioAssets: AudioAsset[]; // 返回修改后的 audioAssets
}

export interface SingleExtendResult {
    outputPath: string;
    finalDuration: number;
}

export class AudioExtender extends FFmpegExecutor {
    constructor(
        private context?: Context<AudioExtenderInputs, AudioExtenderOutputs>
    ) {
        super();
    }

    /**
     * 批量扩展 AudioAssets 到目标时长
     */
    async extendAudioAssets(params: AudioExtenderInputs): Promise<AudioExtenderOutputs> {
        const { audioAssets, targetDuration } = params;
        const extendedAssets: AudioAsset[] = [];

        for (let i = 0; i < audioAssets.length; i++) {
            const asset = audioAssets[i];
            this.context?.reportLog(`Extending audio asset ${i + 1}/${audioAssets.length}: ${asset.id}`, "stdout");

            try {
                const extendedAsset = await this.extendSingleAudioAsset(asset, targetDuration);
                extendedAssets.push(extendedAsset);
            } catch (error) {
                this.context?.reportLog(`Failed to extend audio asset ${asset.id}: ${error.message}`, "stderr");
                throw error;
            }

            this.context?.reportProgress((i + 1) / audioAssets.length * 100);
        }

        this.context?.reportLog(`✓ All audio assets extended to ${targetDuration}s`, "stdout");
        return { audioAssets: extendedAssets };
    }

    private async extendSingleAudioAsset(
        asset: AudioAsset,
        targetDuration: number
    ): Promise<AudioAsset> {
        const currentDuration = asset.timing.duration;

        // 如果已经达到或超过目标时长，直接返回原资源
        if (currentDuration >= targetDuration) {
            this.context?.reportLog(`Audio ${asset.id} already ${currentDuration}s, no extension needed`, "stdout");
            return asset;
        }

        // 创建临时文件路径
        const originalPath = asset.filePath;
        const tempPath = originalPath.replace(/(\.[^.]+)$/, '_temp$1');

        try {
            // 扩展音频到临时文件
            const result = await this.extendWithSilence({
                inputPath: originalPath,
                outputPath: tempPath,
                currentDuration: currentDuration,
                targetDuration: targetDuration
            });

            // 用扩展后的文件替换原文件
            await fs.rename(tempPath, originalPath);

            // 更新资源信息
            const extendedAsset: AudioAsset = {
                ...asset,
                timing: {
                    ...asset.timing,
                    duration: result.finalDuration,
                    endTime: asset.timing.startTime + result.finalDuration
                },
                fileSize: await this.getFileSize(originalPath)
            };

            return extendedAsset;
        } catch (error) {
            // 清理临时文件
            await fs.unlink(tempPath).catch(() => { });
            throw error;
        }
    }

    /**
     * 在音频末尾添加静音以达到目标时长
     */
    async extendWithSilence(params: AudioExtenderOptions): Promise<SingleExtendResult> {
        const { inputPath, outputPath, currentDuration, targetDuration } = params;
        const silenceDuration = targetDuration - currentDuration;

        this.context?.reportLog(`Extending audio from ${currentDuration.toFixed(2)}s to ${targetDuration}s`, "stdout");

        if (silenceDuration <= 0) {
            // 如果不需要添加静音，直接复制文件
            await fs.copyFile(inputPath, outputPath);
            return { outputPath, finalDuration: currentDuration };
        }

        const preciseSilenceDuration = Math.round(silenceDuration * 100) / 100;

        // 使用统一格式的临时文件
        const tempOriginalFile = outputPath.replace(/(\.[^.]+)$/, '_original.wav');
        const tempSilenceFile = outputPath.replace(/(\.[^.]+)$/, '_silence.wav');
        const tempListFile = outputPath.replace(/(\.[^.]+)$/, '_list.txt');
        const tempCombinedFile = outputPath.replace(/(\.[^.]+)$/, '_combined.wav');

        try {
            // 第一步：将原始音频转换为WAV格式
            const convertArgs = [
                '-y',
                '-i', inputPath,
                '-c:a', 'pcm_s16le',
                '-ar', '24000',
                '-ac', '1',
                tempOriginalFile
            ];

            await this.runFFmpegCommand(convertArgs);

            // 第二步：生成静音WAV文件
            const silenceArgs = [
                '-y',
                '-f', 'lavfi',
                '-i', `anullsrc=sample_rate=24000:channel_layout=mono`,
                '-t', preciseSilenceDuration.toFixed(2),
                '-c:a', 'pcm_s16le',
                tempSilenceFile
            ];

            await this.runFFmpegCommand(silenceArgs);

            // 第三步：创建文件列表（使用绝对路径）
            const absoluteOriginalPath = path.resolve(tempOriginalFile);
            const absoluteSilencePath = path.resolve(tempSilenceFile);
            const listContent = `file '${absoluteOriginalPath}'\nfile '${absoluteSilencePath}'`;
            await fs.writeFile(tempListFile, listContent, 'utf8');

            this.context?.reportLog(`List file content:\n${listContent}`, "stdout");

            // 第四步：使用concat demuxer合并文件
            const concatArgs = [
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', tempListFile,
                '-c:a', 'libmp3lame',
                '-b:a', '128k',
                tempCombinedFile
            ];

            await this.runFFmpegCommand(concatArgs);

            // 第五步：精确截取到目标时长并转换为MP3
            const finalArgs = [
                '-y',
                '-i', tempCombinedFile,
                '-t', targetDuration.toFixed(2),  // 精确控制最终时长
                '-c:a', 'libmp3lame',
                '-b:a', '128k',
                outputPath
            ];

            this.context?.reportLog(`outpath ${outputPath}`, "stdout");
            await this.runFFmpegCommand(finalArgs);

            // 验证最终文件时长
            const finalDuration = await this.getAudioDuration(outputPath);
            this.context?.reportLog(`Final audio duration: ${finalDuration.toFixed(2)}s (target: ${targetDuration}s)`, "stdout");

            // 清理临时文件
            await Promise.all([
                fs.unlink(tempOriginalFile).catch(() => {}),
                fs.unlink(tempSilenceFile).catch(() => {}),
                fs.unlink(tempListFile).catch(() => {}),
                fs.unlink(tempCombinedFile).catch(() => {})
            ]);
            this.context?.reportLog(`✓ Audio extended successfully: ${outputPath}`, "stdout");
            return { outputPath, finalDuration: finalDuration };
        } catch (error) {
            // 清理临时文件
            await Promise.all([
                fs.unlink(tempOriginalFile).catch(() => {}),
                fs.unlink(tempSilenceFile).catch(() => {}),
                fs.unlink(tempListFile).catch(() => {}),
                fs.unlink(tempCombinedFile).catch(() => {})
            ]);
            throw new Error(`Failed to extend audio: ${error.message}`);
        }
    }
}

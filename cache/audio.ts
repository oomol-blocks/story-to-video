import type { Context } from "@oomol/types/oocana";
import path from "path";

import { AudioGenerator, AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { AudioFileManager, createdManagers } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";

// 创建音频生成器
export async function createCachedAudioGenerator(
    context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
    blockId: string
): Promise<{ generator: CachedAudioGenerator, cleanup: () => Promise<void> }> {
    const cacheManager = CacheManager.getInstance(context);
    const generator = new CachedAudioGenerator(context, cacheManager, blockId);

    await generator.initialize();

    return {
        generator,
        cleanup: async () => {
            await generator.destroy();
        }
    };
}

export class CachedAudioGenerator {
    private stepCache: StepCache;
    private generator: AudioGenerator;
    private audioFileManager: AudioFileManager;
    private fileManager: FileManager;
    private cleanup?: () => Promise<void>;
    private isInitialized = false;

    constructor(
        private context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
        private cacheManager: CacheManager,
        private BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new AudioGenerator(context);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const managers = await createdManagers(this.context);
            this.fileManager = managers.fileManager;
            this.cleanup = managers.cleanup;
            this.audioFileManager = new AudioFileManager(this.fileManager);
            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize CachedAudioGenerator: ${error.message}`);
        }
    }

    private ensureInitialized(): void {
        if (!this.isInitialized || !this.fileManager || !this.audioFileManager) {
            throw new Error('CachedAudioGenerator not initialized. Call initialize() first.');
        }
    }

    /**
     * 生成音频，判断是否可以恢复
     */
    async generateAudio(params: AudioGeneratorInputs, resumeData?: any): Promise<AudioGeneratorOutputs> {
        this.ensureInitialized();
        this.context.reportLog('Generating audio files...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, resumeData);

        // 生成剩余的音频
        await this.generateRemainingAudio(params, state);

        // 返回结果
        return this.buildResult(state);
    }

    /**
     * 初始化生成状态——恢复或重新开始
     */
    private initializeState(params: AudioGeneratorInputs, resumeData?: any) {
        const audioAssets = resumeData?.audioAssets || [];
        const currentStartTime = resumeData?.currentStartTime || 0;
        const startIndex = resumeData?.completedCount || 0;

        if (audioAssets.length > 0) {
            this.context.reportLog(
                `Resumed with ${audioAssets.length} existing audio assets from index ${startIndex}`,
                "stdout"
            );
        }

        return {
            audioAssets,
            currentStartTime,
            startIndex,
            totalTexts: params.texts.length
        };
    }

    /**
     * 生成剩余的音频文件
     */
    private async generateRemainingAudio(params: AudioGeneratorInputs, state: any) {
        for (let i = state.startIndex; i < params.texts.length; i++) {
            const text = params.texts[i];

            // 生成单个音频
            const audioAsset = await this.generateSingleAudioCached(text, params, state.currentStartTime);

            // 更新状态
            state.audioAssets.push(audioAsset);
            state.currentStartTime = audioAsset.timing.endTime;

            // 保存进度
            await this.saveProgress(i + 1, params.texts.length, state);
        }
    }

    /**
     * 生成单个音频文件，判断是否有缓存
     */
    private async generateSingleAudioCached(
        text: { id: string; content: string },
        params: AudioGeneratorInputs,
        startTime: number
    ) {
        // 如果指定输出目录，则直接在指定目录中生成资源
        if (params.outputDir) {
            const filePath = path.join(params.outputDir, 'audio', `${text.id}.${params.config.format}`);

            return await this.stepCache.executeStep(
                `audio-${text.id}`,
                () => this.generator.generateSingleAudioToPath(text, params.config, filePath, startTime),
                `Generate audio for text ${text.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器放置到特定的文件中
            return await this.generateSingleAudioWithFileManagement(text, params, startTime);
        }
    }

    private async generateSingleAudioWithFileManagement(
        text: { id: string; content: string },
        params: AudioGeneratorInputs,
        startTime: number
    ) {
        return await this.stepCache.executeStepWithFiles(
            `audio-${text.id}`,
            async () => {
                // 创建文件管理记录
                const managedFile = await this.audioFileManager.createAudioFile(
                    text.id,
                    params.config.format,
                    text.content
                );

                try {
                    // 更新状态为处理
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.PROCESSING);

                    // 生成音频到临时路径
                    const tempAudioAsset = await this.generator.generateSingleAudioToPath(
                        text,
                        params.config,
                        managedFile.tempPath!,
                        startTime
                    );

                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.COMPLETED);

                    return {
                        result: tempAudioAsset,
                        fileIds: [managedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            `Generate audio for text ${text.id}`
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any) {
        const progress = (completed / total) * 100;

        await this.cacheManager.updateBlockProgress(this.BLOCK_ID, progress, {
            completedCount: completed,
            audioAssets: [...state.audioAssets],
            currentStartTime: state.currentStartTime
        });

        await this.context.reportProgress(progress);
    }

    private buildResult(state: any): AudioGeneratorOutputs {
        const totalDuration = state.audioAssets.reduce(
            (sum: number, asset: any) => sum + asset.timing.duration,
            0
        );

        this.context.reportLog(
            `Audio generation completed. Total duration: ${totalDuration.toFixed(2)}s`,
            "stdout"
        );

        return {
            audioAssets: state.audioAssets,
            totalDuration
        };
    }

    async destroy(): Promise<void> {
        if (this.cleanup) {
            await this.cleanup();
            this.context.reportLog("CachedAudioGenerator destroyed", "stdout");
        }
    }
}

import type { Context } from "@oomol/types/oocana";
import path from "path";

import { AudioGenerator, AudioGeneratorInputs, AudioGeneratorOutputs } from "~/core/AudioGenerator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { AudioFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";

export class CachedAudioGenerator {
    private stepCache: StepCache;
    private generator: AudioGenerator;
    private audioFileManager: AudioFileManager;
    private fileManager: FileManager;
    private initPromise: Promise<void>;

    constructor(
        private context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
        private cacheManager: CacheManager,
        BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new AudioGenerator(context);

        this.initPromise = this.doInitialize();
    }

    private async doInitialize(): Promise<void> {
        try {
            this.fileManager = new FileManager(this.context, this.cacheManager);
            await this.fileManager.initialize();

            this.audioFileManager = new AudioFileManager(this.fileManager);
        } catch (error) {
            throw new Error(`Failed to initialize CachedAudioGenerator: ${error.message}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
        if (!this.fileManager || !this.audioFileManager) {
            throw new Error('CachedAudioGenerator initialization failed');
        }
    }

    /**
     * 生成音频，判断是否可以恢复
     */
    async generateAudio(params: AudioGeneratorInputs, resumeData?: any): Promise<AudioGeneratorOutputs> {
        await this.ensureInitialized();
        this.context.reportLog('Generating audio files...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, resumeData);

        try {
            // 生成剩余的音频
            await this.generateRemainingAudio(params, state);

            // 返回结果
            return this.buildResult(state);
        } catch (error) {
            // 保存当前状态
            await this.cacheManager.updateProgress((state.startIndex / params.texts.length) * 80, {
                audioAssets: state.audioAssets,
                currentSegmentIndex: state.startIndex,
                error: error.message
            });

            throw error;
        }
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
            const audioAsset = await this.generateAudioCached(text, params, state.currentStartTime);

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
    private async generateAudioCached(
        text: { id: string; content: string },
        params: AudioGeneratorInputs,
        startTime: number
    ) {
        // 如果指定输出目录，则直接在指定目录中生成资源
        if (params.outputDir) {
            const filePath = path.join(params.outputDir, 'audio', `${text.id}.${params.config.format}`);
            return await this.stepCache.executeStep(
                `audio-${text.id}`,
                async () => await this.generator.generateAudio(text, params.config, filePath, startTime),
                `Generate audio for text ${text.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器放置到特定的文件中
            return await this.generateAudioWithFileManagement(text, params, startTime);
        }
    }

    private async generateAudioWithFileManagement(
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
                    const tempAudioAsset = await this.generator.generateAudio(
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

        await this.cacheManager.updateProgress(progress, {
            completedCount: completed,
            audioAssets: [...state.audioAssets],
            currentStartTime: state.currentStartTime
        });

        await this.context.reportProgress(progress);
    }

    private buildResult(state: any): AudioGeneratorOutputs {
        return {
            audioAssets: state.audioAssets
        };
    }

    async destroy(): Promise<void> {
        await this.initPromise;
        if (this.fileManager) {
            await this.fileManager.destroy();
        }
    }
}

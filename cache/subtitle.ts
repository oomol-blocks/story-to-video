import type { Context } from "@oomol/types/oocana";
import path from "path";

import { SubtitleGenerator, SubtitleGeneratorInputs, SubtitleGeneratorOutputs } from "~/core/SubtitleGenerator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { SubtitleFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";
import { SubtitleConfig } from "~/utils/constants";

export class CachedSubtitleGenerator {
    private stepCache: StepCache;
    private generator: SubtitleGenerator;
    private subtitleFileManager: SubtitleFileManager;
    private fileManager: FileManager;
    private initPromise: Promise<void>;

    constructor(
        private context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>,
        private cacheManager: CacheManager,
        BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new SubtitleGenerator(context);

        this.initPromise = this.doInitialize();
    }

    private async doInitialize(): Promise<void> {
        try {
            this.fileManager = new FileManager(this.context, this.cacheManager);
            await this.fileManager.initialize();

            this.subtitleFileManager = new SubtitleFileManager(this.fileManager);
        } catch (error) {
            throw new Error(`Failed to initialize CachedSubtitleGenerator: ${error.message}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
        if (!this.fileManager || !this.subtitleFileManager) {
            throw new Error('CachedSubtitleGenerator initialization failed');
        }
    }

    /**
     * 生成字幕文件
     */
    async generateSubtitles(
        params: SubtitleGeneratorInputs,
        config: SubtitleConfig,
        resumeData?: any
    ): Promise<SubtitleGeneratorOutputs> {
        await this.ensureInitialized();
        this.context.reportLog('Generating subtitles...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, resumeData);

        // 生成剩余的字幕
        await this.generateRemainingSubtitles(params, config, state);

        // 返回结果
        return this.buildResult(state);
    }

    /**
     * 初始化生成状态
     */
    private initializeState(params: SubtitleGeneratorInputs, resumeData?: any) {
        const subtitleAssets = resumeData?.subtitleAssets || [];
        const startIndex = resumeData?.completedCount || 0;

        if (subtitleAssets.length > 0) {
            this.context.reportLog(
                `Resumed with ${subtitleAssets.length} existing subtitle assets from index ${startIndex}`,
                "stdout"
            );
        }
        return {
            subtitleAssets,
            startIndex,
            totalTexts: params.texts.length
        };
    }

    /**
     * 生成剩余的字幕文件
     */
    private async generateRemainingSubtitles(
        params: SubtitleGeneratorInputs,
        config: SubtitleConfig,
        state: any
    ) {
        for (let i = state.startIndex; i < params.texts.length; i++) {
            const text = params.texts[i];

            // 生成单个字幕文件
            const subtitleAsset = await this.generateSubtitleCached(text, config, params);

            // 更新状态
            state.subtitleAssets.push(subtitleAsset);

            // 保存进度
            await this.saveProgress(i + 1, params.texts.length, state);
        }
    }

    /**
     * 生成单个字幕文件
     */
    private async generateSubtitleCached(
        text: { id: string; content: string; sentences?: string[]; timing: any },
        config: SubtitleConfig,
        params: SubtitleGeneratorInputs
    ) {
        // 如果指定输出目录，则直接在指定目录中生成资源
        if (params.outputDir) {
            const filePath = path.join(params.outputDir, `subtitle_${text.id}.${config.format}`);
            return await this.stepCache.executeStep(
                `subtitle-${text.id}`,
                async () => await this.generator.generateSubtitle(text, config, filePath),
                `Generate subtitle for text ${text.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器放置到特定的文件中
            return await this.generateSubtitleWithFileManagement(text, config);
        }
    }

    private async generateSubtitleWithFileManagement(
        text: { id: string; content: string; sentences?: string[]; timing: any },
        config: SubtitleConfig
    ) {
        return await this.stepCache.executeStepWithFiles(
            `subtitle-${text.id}`,
            async () => {
                // 创建文件管理记录
                const managedFile = await this.subtitleFileManager.createSubtitleFile(
                    text.id,
                    config.format,
                    text.content
                );

                try {
                    // 更新状态为处理
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.PROCESSING);

                    const subtitleAsset = await this.generator.generateSubtitle(
                        text,
                        config,
                        managedFile.tempPath
                    );

                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.COMPLETED);

                    return {
                        result: subtitleAsset,
                        fileIds: [managedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            `Generate subtitle for text ${text.id}`
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any) {
        const progress = (completed / total) * 100;

        await this.cacheManager.updateProgress(progress, {
            completedCount: completed,
            subtitleAssets: [...state.subtitleAssets]
        });

        await this.context.reportProgress(progress);
    }

    /**
     * 构建最终结果
     */
    private buildResult(state: any): SubtitleGeneratorOutputs {
        this.context.reportLog(
            `Subtitle generation completed. Generated ${state.subtitleAssets.length} subtitles`,
            "stdout"
        );

        return {
            subtitleAssets: state.subtitleAssets
        };
    }

    async destroy(): Promise<void> {
        await this.initPromise;
        if (this.fileManager) {
            await this.fileManager.destroy();
        }
    }
}

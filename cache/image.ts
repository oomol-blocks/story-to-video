import type { Context } from "@oomol/types/oocana";
import path from "path";

import { ImageGenerator, ImageGeneratorInputs, ImageGeneratorOutputs } from "~/core/ImageGenarator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { ImageFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";

export class CachedImageGenerator {
    private stepCache: StepCache;
    private generator: ImageGenerator;
    private imageFileManager: ImageFileManager;
    private fileManager: FileManager;
    private initPromise: Promise<void>;

    constructor(
        private context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
        private cacheManager: CacheManager,
        BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new ImageGenerator(context);

        this.initPromise = this.doInitialize();
    }

    private async doInitialize(): Promise<void> {
        try {
            this.fileManager = new FileManager(this.context, this.cacheManager);
            await this.fileManager.initialize();

            this.imageFileManager = new ImageFileManager(this.fileManager);
        } catch (error) {
            throw new Error(`Failed to initialize CachedImageGenerator: ${error.message}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
        if (!this.fileManager || !this.imageFileManager) {
            throw new Error('CachedImageGenerator initialization failed');
        }
    }

    /**
     * 生成图片
     */
    async generateImages(params: ImageGeneratorInputs, resumeData?: any): Promise<ImageGeneratorOutputs> {
        await this.ensureInitialized();
        this.context.reportLog('Generating images...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, resumeData);

        // 生成剩余的图片
        await this.generateRemainingImages(params, state);

        // 返回结果
        return this.buildResult(state);
    }

    /**
     * 初始化生成状态
     */
    private initializeState(params: ImageGeneratorInputs, resumeData?: any) {
        const imageAssets = resumeData?.imageAssets || [];
        const startIndex = resumeData?.completedCount || 0;

        if (imageAssets.length > 0) {
            this.context.reportLog(
                `Resumed with ${imageAssets.length} existing image assets from index ${startIndex}`,
                "stdout"
            );
        }
        return {
            imageAssets,
            startIndex,
            totalPrompts: params.prompts.length
        };
    }

    /**
     * 生成剩余的图片文件
     */
    private async generateRemainingImages(params: ImageGeneratorInputs, state: any) {
        for (let i = state.startIndex; i < params.prompts.length; i++) {
            const prompt = params.prompts[i];

            // 生成单个图片
            const imageAsset = await this.generateImageCached(prompt, params);

            // 更新状态
            state.imageAssets.push(imageAsset);

            // 保存进度
            await this.saveProgress(i + 1, params.prompts.length, state);
        }
    }

    /**
     * 生成单个图片文件
     */
    private async generateImageCached(
        prompt: { id: string; content: string; style?: string },
        params: ImageGeneratorInputs
    ) {
        // 如果指定输出目录，则直接在指定目录中生成资源
        if (params.outputDir) {
            const filePath = path.join(params.outputDir, `image_${prompt.id}.${params.config.format || "png"}`);

            return await this.stepCache.executeStep(
                `image-${prompt.id}`,
                async () => await this.generator.generateImage(prompt, params.config, filePath),
                `Generate image for prompt ${prompt.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器放置到特定的文件中
            return await this.generateImageWithFileManagement(prompt, params);
        }
    }

    private async generateImageWithFileManagement(
        prompt: { id: string; content: string; style?: string },
        params: ImageGeneratorInputs
    ) {
        return await this.stepCache.executeStepWithFiles(
            `image-${prompt.id}`,
            async () => {
                // 创建文件管理记录
                const managedFile = await this.imageFileManager.createImageFile(
                    prompt.id,
                    params.config.format || "png",
                    prompt.content
                );

                try {
                    // 更新状态为处理
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.PROCESSING);

                    const imageAsset = await this.generator.generateImage(prompt, params.config, managedFile.tempPath)

                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.COMPLETED);

                    return {
                        result: imageAsset,
                        fileIds: [managedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            `Generate image for prompt ${prompt.id}`
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any) {
        const progress = (completed / total) * 100;

        await this.cacheManager.updateProgress(progress, {
            completedCount: completed,
            imageAssets: [...state.imageAssets]
        });

        await this.context.reportProgress(progress);
    }

    /**
     * 构建最终结果
     */
    private buildResult(state: any): ImageGeneratorOutputs {
        this.context.reportLog(
            `Image generation completed. Generated ${state.imageAssets.length} images`,
            "stdout"
        );

        return {
            imageAssets: state.imageAssets
        };
    }

    async destroy(): Promise<void> {
        await this.initPromise;
        if (this.fileManager) {
            await this.fileManager.destroy();
        }
    }
}

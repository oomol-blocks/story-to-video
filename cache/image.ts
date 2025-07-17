import type { Context } from "@oomol/types/oocana";
import { ImageGenerator, ImageGeneratorInputs, ImageGeneratorOutputs } from "~/utils/ImageGenarator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { createdManagers, ImageFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";

export async function createCachedImageGenerator(
    context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
    blockId: string
): Promise<{ generator: CachedImageGenerator, cleanup: () => Promise<void> }> {
    const cacheManager = CacheManager.getInstance(context);
    const generator = new CachedImageGenerator(context, cacheManager, blockId);

    await generator.initialize();

    return {
        generator,
        cleanup: async () => {
            await generator.destroy();
        }
    };
}

export class CachedImageGenerator {
    private stepCache: StepCache;
    private generator: ImageGenerator;
    private imageFileManager: ImageFileManager;
    private fileManager: FileManager;
    private cleanup?: () => Promise<void>;
    private isInitialized = false;

    constructor(
        private context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
        private cacheManager: CacheManager,
        private BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new ImageGenerator(context);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const managers = await createdManagers(this.context);
            this.fileManager = managers.fileManager;
            this.cleanup = managers.cleanup;
            this.imageFileManager = new ImageFileManager(this.fileManager);
            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize CachedImageGenerator: ${error.message}`);
        }
    }

    private ensureInitialized(): void {
        if (!this.isInitialized || !this.fileManager || !this.imageFileManager) {
            throw new Error('CachedImageGenerator not initialized. Call initialize() first.');
        }
    }

    /**
     * 生成图片
     */
    async generateImages(params: ImageGeneratorInputs, resumeData?: any): Promise<ImageGeneratorOutputs> {
        this.ensureInitialized();
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
            const imageAsset = await this.generateSingleImageCached(prompt, params);

            // 更新状态
            state.imageAssets.push(imageAsset);

            // 保存进度
            await this.saveProgress(i + 1, params.prompts.length, state);
        }
    }

    /**
     * 生成单个图片文件
     */
    private async generateSingleImageCached(
        prompt: { id: string; content: string; style?: string },
        params: ImageGeneratorInputs
    ) {
        // 如果指定输出目录，则直接在指定目录中生成资源
        if (params.outputDir) {
            const filePath = `${params.outputDir}/image/image_${prompt.id}.${params.config.format}`;

            return await this.stepCache.executeStep(
                `image-${prompt.id}`,
                () => this.generator.generateSingleImage(prompt, params.config, filePath),
                `Generate image for prompt ${prompt.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器放置到特定的文件中
            return await this.generateSingleImageWithFileManagement(prompt, params);
        }
    }

    private async generateSingleImageWithFileManagement(
        prompt: { id: string; content: string; style?: string },
        params: ImageGeneratorInputs
    ) {
        return await this.stepCache.executeStepWithFiles(
            `image-${prompt.id}`,
            async () => {
                // 创建文件管理记录
                const managedFile = await this.imageFileManager.createImageFile(
                    prompt.id,
                    params.config.format,
                    prompt.content
                );

                try {
                    // 更新状态为处理
                    await this.fileManager.updateFileStatus(managedFile.id, FileStatus.PROCESSING);

                    const imageAsset = this.generator.generateSingleImage(prompt, params.config, managedFile.tempPath)

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

        await this.cacheManager.updateBlockProgress(this.BLOCK_ID, progress, {
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
        if (this.cleanup) {
            await this.cleanup();
            this.context.reportLog("CachedImageGenerator destroyed", "stdout");
        }
    }
}

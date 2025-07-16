import type { Context } from "@oomol/types/oocana";
import { ImageGenerator, ImageGeneratorInputs, ImageGeneratorOutputs } from "~/utils/ImageGenarator";
import { WorkflowCacheManager, StepCache } from "~/utils/Cache";

export class CachedImageGenerator {
    private stepCache: StepCache;
    private generator: ImageGenerator;

    constructor(
        private context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
        private cacheManager: WorkflowCacheManager,
        private BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new ImageGenerator(context);
    }

    /**
     * 生成图片
     */
    async generateImages(params: ImageGeneratorInputs, resumeData?: any): Promise<ImageGeneratorOutputs> {
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
        return await this.stepCache.executeStep(
            `${this.BLOCK_ID}-${prompt.id}`,
            () => this.generator.generateSingleImage(prompt, params.config, params.outputDir),
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
}

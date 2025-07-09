import { Context } from "@oomol/types/oocana";

import { ScriptScene } from "./ScriptParser";
import { DallE3ImageSize, DallE3ImageSizeType, isValidDallE3ImageSize3, VideoSizeType } from "./constants";

export interface ImageAsset {
    sceneId: number;
    filePath: string; // 图片路径，url 形式
    prompt: string;
    resolution: string;
}

export interface ImageGeneratorInputs {
    scenes: ScriptScene[];
    imagePromptOptions: {
        historicalPeriod: string;
        characterTraits: string;
        baseImageStyle: string;
    };
    API_KEY: string;
    imageSize: DallE3ImageSizeType;
    videoSize: VideoSizeType;
}

export interface ImageGeneratorOutputs {
    imageAssets: ImageAsset[];
}

export class ImageGenerator {
    private readonly BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
    private readonly MODEL = "doubao-seedream-3-0-t2i-250415";

    private resolution = DallE3ImageSize.PORTRAIT as DallE3ImageSizeType;

    async generateImages(
        params: ImageGeneratorInputs,
        context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
    ): Promise<ImageGeneratorOutputs> {
        console.log("Starting image generation...");
        context.reportProgress(0);

        const { scenes, API_KEY, imageSize, videoSize, imagePromptOptions } = params;
        const { historicalPeriod, characterTraits, baseImageStyle } = imagePromptOptions;
        const imageAssets: ImageAsset[] = [];

        if (isValidDallE3ImageSize3(imageSize)) {
            this.resolution = imageSize;
        } else {
            console.warn(`Unknown image size: ${imageSize}, using default portrait（${DallE3ImageSize.PORTRAIT}） params`);
        }

        const basePrompt = this.getBaseImagePrompt(videoSize, historicalPeriod, characterTraits, baseImageStyle);

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const fullPrompt = `${basePrompt}场景描述: ${scene.visualPrompt}`;

            console.log(`Generating image for scene ${scene.id}: ${scene.description}. Prompt: ${fullPrompt}`);

            try {
                const imageUrl = await this.generateSingleImage(
                    fullPrompt,
                    API_KEY,
                );

                imageAssets.push({
                    sceneId: scene.id,
                    filePath: imageUrl,
                    prompt: fullPrompt,
                    resolution: this.resolution
                });

                const progress = ((i + 1) / scenes.length) * 100;
                context.reportProgress(progress);

                console.log(`✓ Generated image for scene ${scene.id}`);
            } catch (error) {
                console.error(`Failed to generate image for scene ${scene.id}:`, error);
                throw error;
            }
        }

        console.log(`✓ Generated ${imageAssets.length} images`);

        return { imageAssets };
    }

    private async generateSingleImage(
        prompt: string,
        apiKey: string,
    ): Promise<string> {
        const requestBody = {
            prompt: prompt,
            model: this.MODEL,
            size: this.resolution,
            response_format: "url",
            watermark: false
        };

        const response = await fetch(this.BASE_URL, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Image generation API failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const imageUrl = result?.data[0]?.url;

        if (!imageUrl) {
            throw new Error('No image URL in API response');
        }

        return imageUrl;
    }

    private getBaseImagePrompt(videoSize: string, period: string, characterTraits: string, baseImageStyle: string): string {
        return `生成适合${period || "中国文化传统"}的漫画风格插图：

风格特点：
- 卡通漫画风格，色彩鲜艳
- 人物造型可爱，表情生动
- 背景简洁但有古代特色
- 整体画面适合儿童观看

技术规格：
- ${videoSize}构图，适合视频格式
- 高清画质
- 色彩饱和度适中
- 避免过于复杂的细节

人物特征：
${characterTraits}

基础风格：
${baseImageStyle}
`;
    }
}

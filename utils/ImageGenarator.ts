import { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { ScriptScene } from "./ScriptParser";

export interface ImageAsset {
    sceneId: number;
    filePath: string;
    prompt: string;
}

export interface ImageGeneratorInputs {
    scenes: ScriptScene[];
    API_KEY: string;
    outputDir: string;
}

export interface ImageGeneratorOutputs {
    imageAssets: ImageAsset[];
}

export class ImageGenerator {
    async generateImages(
        params: ImageGeneratorInputs,
        context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
    ): Promise<ImageGeneratorOutputs> {
        console.log("Starting image generation...");
        context.reportProgress(0);

        const { scenes, API_KEY, outputDir } = params;
        const imageAssets: ImageAsset[] = [];

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        const basePrompt = this.getBaseImagePrompt();

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const fullPrompt = `${basePrompt}\n\n场景描述: ${scene.visualPrompt}`;

            console.log(`Generating image for scene ${scene.id}: ${scene.description}`);

            try {
                const imageFile = await this.generateSingleImage(
                    fullPrompt,
                    scene.id,
                    API_KEY,
                    outputDir
                );

                imageAssets.push({
                    sceneId: scene.id,
                    filePath: imageFile,
                    prompt: fullPrompt
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
        sceneId: number,
        apiKey: string,
        outputDir: string
    ): Promise<string> {
        const imageFile = path.join(outputDir, `image_${sceneId}.png`);

        const urlencoded = new URLSearchParams();
        urlencoded.append("prompt", prompt);
        urlencoded.append("model", "dall-e-3");
        urlencoded.append("size", "1024x1792");
        urlencoded.append("n", "1");
        urlencoded.append("response_format", "b64_json");
        urlencoded.append("stype", "vivid");

        const response = await fetch("https://aigptx.top/v1/images/generations", {
            method: 'POST',
            body: urlencoded,
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Image generation API failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const base64Image = result.data[0].b64_json;

        if (!base64Image) {
            throw new Error('No base64 image data in API response');
        }

        const imageBuffer = Buffer.from(base64Image, 'base64');
        await fs.writeFile(imageFile, imageBuffer);

        return imageFile;
    }

    public getBaseImagePrompt(): string {
        return `生成中国古代三国时期的漫画风格插图，要求：

风格特点：
- 卡通漫画风格，色彩鲜艳
- 人物造型可爱，表情生动
- 背景简洁但有古代特色
- 整体画面适合儿童观看

技术要求：
- 16:9横版构图
- 高清画质
- 色彩饱和度适中
- 避免过于复杂的细节

人物特征：
- 诸葛亮：白色羽扇，智者形象
- 周瑜：年轻将军，略显急躁
- 曹军：远景中的模糊身影
- 鲁肃：憨厚老实的样子

环境设定：
- 古代军营、江面、战船
- 体现三国时期的历史背景
- 适当的雾气和水墨风格元素`;
    }
}

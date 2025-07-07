import { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import path from 'path';

import { ScriptScene } from "./ScriptParser";
import { DallE3ImageSize, DallE3ImageSizeType, isValidDallE3ImageSize3, VideoSizeType } from "./constants";

export interface ImageAsset {
    sceneId: number;
    filePath: string;
    prompt: string;
    resolution: string;
}

export interface ImageGeneratorInputs {
    scenes: ScriptScene[];
    API_KEY: string;
    imageSize: DallE3ImageSizeType;
    videoSize: VideoSizeType;
    outputDir: string;
}

export interface ImageGeneratorOutputs {
    imageAssets: ImageAsset[];
}

export class ImageGenerator {
    private readonly BASE_URL = "https://cn2us02.opapi.win/v1/images/generations";
    private resolution = DallE3ImageSize.PORTRAIT as DallE3ImageSizeType;

    async generateImages(
        params: ImageGeneratorInputs,
        context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
    ): Promise<ImageGeneratorOutputs> {
        console.log("Starting image generation...");
        context.reportProgress(0);

        const { scenes, API_KEY, outputDir, imageSize, videoSize } = params;
        const imageAssets: ImageAsset[] = [];

        if (isValidDallE3ImageSize3(imageSize)) {
            this.resolution = imageSize;
        } else {
            console.warn(`Unknown image size: ${imageSize}, using default portrait（${DallE3ImageSize.PORTRAIT}） params`);
        }

        // 确保输出目录存在
        await fs.mkdir(outputDir, { recursive: true });

        const basePrompt = this.getBaseImagePrompt(videoSize);

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const fullPrompt = this.buildScenePrompt(scene, i, scenes.length, basePrompt);

            console.log(`Generating image for scene ${scene.id}: ${scene.description}. Prompt: ${fullPrompt}`);

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
        sceneId: number,
        apiKey: string,
        outputDir: string
    ): Promise<string> {
        const imageFile = path.join(outputDir, `image_${sceneId}.png`);

        const urlencoded = new URLSearchParams();
        urlencoded.append("prompt", prompt);
        urlencoded.append("model", "dall-e-3");
        urlencoded.append("size", this.resolution);
        urlencoded.append("n", "1");
        urlencoded.append("response_format", "b64_json");
        urlencoded.append("stype", "vivid");

        const response = await fetch(this.BASE_URL, {
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

    private buildScenePrompt(
        scene: ScriptScene,
        sceneIndex: number,
        totalScenes: number,
        basePrompt: string
    ): string {
        // 构建连贯性提示
        const continuityPrompt = this.getContinuityPrompt(sceneIndex, totalScenes);

        // 构建动画友好的提示
        const animationPrompt = this.getAnimationFriendlyPrompt(sceneIndex, totalScenes);

        // 构建人物特征提示
        const characterPrompt = this.getCharacterPrompt(scene.characterTraits);

        // 组合完整的提示
        return `${basePrompt}

${continuityPrompt}

${animationPrompt}

${characterPrompt}

基础画面风格: ${scene.baseImageStyle}

场景描述: ${scene.visualPrompt}

场景编号: ${sceneIndex + 1}/${totalScenes}`;
    }

    private getCharacterPrompt(characterTraits: string): string {
        if (!characterTraits || characterTraits.includes('根据故事内容设计')) {
            return `人物形象要求：
- 设计符合中国传统文化的人物形象
- 人物特征要鲜明且容易识别
- 造型要适合中国儿童观看，亲切友好
- 服装和配饰要符合故事背景`;
        }

        return `人物特征要求（严格遵循）：
${characterTraits}

重要提示：
- 人物形象必须与中国文化相符，不能出现西方的服饰、发型、饰品等。
- 不得随意改变经典角色的标志性特征
- 服装、配饰、表情都要符合角色设定
- 在所有场景中保持角色形象的绝对一致性`;
    }

    private getContinuityPrompt(sceneIndex: number, totalScenes: number): string {
        if (sceneIndex === 0) {
            return `连贯性要求 - 开场场景：
- 建立主要角色的标准造型和色彩方案
- 确定整体画面的色调和光线风格
- 设定背景环境的基本元素
- 构图要为后续场景转换留出空间`;
        } else if (sceneIndex === totalScenes - 1) {
            return `连贯性要求 - 结尾场景：
- 保持与前面场景一致的角色造型和色彩
- 延续统一的画面风格和光线效果
- 背景元素要与前面场景呼应
- 构图要体现故事的完整性`;
        } else {
            return `连贯性要求 - 中间场景：
- 严格保持角色造型、服装、色彩的一致性
- 延续前面场景的画面风格和色调
- 背景元素要有逻辑关联和过渡
- 构图要考虑与前后场景的衔接`;
        }
    }

    private getAnimationFriendlyPrompt(sceneIndex: number, totalScenes: number): string {
        const baseAnimation = `动画优化要求：
- 人物和主要元素要有清晰的轮廓，便于动画处理
- 背景分层明确：前景、中景、背景要有明显区分
- 预留动态元素空间：人物动作、物体移动、特效区域
- 色彩对比度适中，避免过度复杂的细节`;

        if (sceneIndex === 0) {
            return `${baseAnimation}
- 开场动画：设置可以淡入或滑入的元素
- 人物出场：预留角色登场的动画空间`;
        } else if (sceneIndex === totalScenes - 1) {
            return `${baseAnimation}
- 结尾动画：设置可以淡出或收缩的元素
- 总结效果：预留文字或图标的展示空间`;
        } else {
            return `${baseAnimation}
- 过渡动画：设置便于场景切换的元素
- 连接效果：预留承接前后场景的动画空间`;
        }
    }


    private getBaseImagePrompt(videoSize: string): string {
        return `生成适合中国的儿童教育的漫画风格插图，专为视频动画制作优化：

核心风格要求：
- 清晰的卡通漫画风格，色彩鲜艳但不刺眼
- 人物造型简洁可爱，表情生动易识别
- 背景分层明确，便于后期动画处理
- 整体画面适合儿童观看，温馨友好

动画制作优化：
- 人物和主要元素轮廓清晰，便于抠图和动画
- 背景、中景、前景层次分明
- 色彩对比度适中，避免过度复杂的纹理
- 预留足够的动态空间，支持镜头移动和元素动画

技术规格：
- ${videoSize}构图，适合视频格式
- 高清画质
- 色彩饱和度适中
- 避免过于复杂的细节
`;
    }
}

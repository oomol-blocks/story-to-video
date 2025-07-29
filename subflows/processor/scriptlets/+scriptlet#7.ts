//#region generated meta
type Inputs = {
    scenes: { id: string; description: string; narration: string; visualPrompt: string; estimatedDuration: number }[];
    sceneMetadata: { historicalPeriod: string; characterTraits: string; baseImageStyle: string };
    imageConfig: { apiEndpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations" | "https://console.oomol.com/v1/images/generations"; model: "doubao-seedream-3-0-t2i-250415"; apiKey: string; size: "1024x1024" | "720x1280" | "1280x720" };
};
type Outputs = {
    prompts: { id: string; content: string }[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function (
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    const { sceneMetadata, imageConfig, scenes } = params;
    const { historicalPeriod, characterTraits, baseImageStyle } = sceneMetadata;
    const { size } = imageConfig;

    const basePrompt = getBaseImagePrompt(size, historicalPeriod, characterTraits, baseImageStyle);

    const prompts = scenes.map(scene => ({
        id: scene.id,
        content: `${basePrompt}场景描述: ${scene.visualPrompt}`
    }));

    return { prompts };
};

function getBaseImagePrompt(videoSize: string, period: string, characterTraits: string, baseImageStyle: string): string {
    return `生成适合${period || "中国文化传统"}的漫画风格插图：

风格特点：
- 卡通漫画风格，色彩鲜艳
- 人物造型可爱，表情生动
- 背景简洁
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

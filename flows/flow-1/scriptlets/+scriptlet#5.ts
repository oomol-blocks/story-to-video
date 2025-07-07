//#region generated meta
type Inputs = {
    videoSize: "1080x1080" | "1080x1920" | "1920x1080";
};
type Outputs = {
    videoSize: "1080x1080" | "1080x1920" | "1920x1080";
    imageSize: "1024x1024" | "1024x1792" | "1792x1024";
};
//#endregion

import type { Context } from "@oomol/types/oocana";
import { getImageSizeFromVideoSize, isValidVideoSize } from "~/utils/constants"

export default async function(
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    const { videoSize } = params;

    if (!isValidVideoSize(videoSize)) {
        throw new Error(`无效的视频尺寸: ${videoSize}`);
    }
    
    // 根据视频尺寸获取对应的 DALL-E 3 图像尺寸
    const imageSize = getImageSizeFromVideoSize(videoSize);

    console.log('image size&video size: ', imageSize, videoSize)
    
    return {
        videoSize,
        imageSize
    };
};

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
import { DallE3ImageSize, type DallE3ImageSizeType, isValidVideoSize, VideoSize, type VideoSizeType } from "~/utils/constants"

/**
 * 视频尺寸到 DALL-E 3 图像尺寸的映射
 * 根据宽高比进行映射：
 * - 1:1 (正方形) -> 1024x1024
 * - 16:9 (横屏) -> 1792x1024  
 * - 9:16 (竖屏) -> 1024x1792
 */
const VIDEO_TO_DALLE3_SIZE_MAP: Record<VideoSizeType, DallE3ImageSizeType> = {
    [VideoSize.SQUARE]: DallE3ImageSize.SQUARE,       // 1080x1080 -> 1024x1024
    [VideoSize.LANDSCAPE]: DallE3ImageSize.LANDSCAPE, // 1920x1080 -> 1792x1024
    [VideoSize.PORTRAIT]: DallE3ImageSize.PORTRAIT    // 1080x1920 -> 1024x1792
} as const;

export function getImageSizeFromVideoSize(videoSize: VideoSizeType): DallE3ImageSizeType {
    return VIDEO_TO_DALLE3_SIZE_MAP[videoSize];
}

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
    
    return {
        videoSize,
        imageSize
    };
};

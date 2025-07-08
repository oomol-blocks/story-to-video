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
    const imageSize = getImageSizeFromVideoSize(videoSize);

    return {
        videoSize,
        imageSize
    };
};

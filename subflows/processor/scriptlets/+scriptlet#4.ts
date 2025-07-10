import type { Context } from "@oomol/types/oocana";
import { DoubaoVideoGenerator, Segment, VideoGeneratorInputs, VideoGeneratorOutputs } from "~/utils/VideoGenerator";

export default async function generateVideo(
    params: VideoGeneratorInputs,
    context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>
): Promise<VideoGeneratorOutputs> {
    const { imageAssets, audioAssets, subtitleAssets } = params
    const segments: Segment[] = [];

    for (let i = 0; i < imageAssets.length; i++) {
        const segment = {
            id: audioAssets[i].id,
            imageAsset: imageAssets[i],
            audioAsset: audioAssets[i],
            subtitleAsset: subtitleAssets[i],
            nextImageAsset: i < imageAssets.length - 1 ? imageAssets[i + 1] : undefined
        };
        segments.push(segment);
    }

    const generator = new DoubaoVideoGenerator(context);
    return await generator.generateVideo(params, segments);
}

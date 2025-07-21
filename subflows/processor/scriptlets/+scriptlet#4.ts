import type { Context } from "@oomol/types/oocana";
import { VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/utils/VideoGenerator";
import { withCache } from "~/cache/CacheManager";
import { createCachedVideoGenerator } from "~/cache/video";

const BLOCK_ID = "generate-video-with-ai";

const generateVideoWithCache = withCache(
    BLOCK_ID,
    async (
        params: VideoGeneratorInputs,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        resumeData?: any
    ): Promise<VideoGeneratorOutputs> => {
        const { imageAssets, audioAssets, subtitleAssets } = params;
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

        const { generator, cleanup } = await createCachedVideoGenerator(context, BLOCK_ID);

        try {
            return await generator.generateVideo(params, segments, resumeData);
        } finally {
            // await cleanup();
        }
    }
);

export default generateVideoWithCache;

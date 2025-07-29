import type { Context } from "@oomol/types/oocana";
import { VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/core/VideoGenerator";
import { CacheManager, withCache } from "~/cache/CacheManager";
import { CachedVideoGenerator } from "~/cache/video";

const BLOCK_ID = "generate-video-with-ai";

const generateVideoWithCache = withCache(
    BLOCK_ID,
    async (
        params: VideoGeneratorInputs,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        cacheManager: CacheManager,
        resumeData?: any
    ): Promise<VideoGeneratorOutputs> => {
        const { imageAssets, durationList } = params;
        const segments: Segment[] = [];

        for (let i = 0; i < imageAssets.length; i++) {
            const segment = {
                id: imageAssets[i].id,
                imageAsset: imageAssets[i],
                nextImageAsset: i < imageAssets.length - 1 ? imageAssets[i + 1] : undefined,
                duration: durationList[i].duration
            } as Segment;
            segments.push(segment);
        }

        const generator = new CachedVideoGenerator(context, cacheManager, BLOCK_ID);
        return await generator.generateVideo(params, segments, resumeData);
    }
);

export default generateVideoWithCache;

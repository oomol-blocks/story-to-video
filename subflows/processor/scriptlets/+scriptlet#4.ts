import type { Context } from "@oomol/types/oocana";
import { VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/utils/VideoGenerator";
import { withCache, WorkflowCacheManager } from "~/utils/Cache";
import { CachedVideoGenerator } from "~/cache/CacheVideoGenerator";

const BLOCK_ID = "generate-video-with-ai";

const generateVideoWithCache = withCache(
    BLOCK_ID,
    async (
        params: VideoGeneratorInputs,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        cacheManager: WorkflowCacheManager,
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

        const cachedGenerator = new CachedVideoGenerator(context, cacheManager, BLOCK_ID);
        return await cachedGenerator.generateVideo(params, segments, resumeData);
    }
);

export default generateVideoWithCache;

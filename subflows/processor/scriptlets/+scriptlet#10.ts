import type { Context } from "@oomol/types/oocana";
import { withCache } from "~/cache/CacheManager";
import { SourceItem, VideoProcessorInputs, VideoProcessorOutputs } from "~/utils/VideoProcessor";
import { createCachedVideoProcessor } from "~/cache/processor";

const BLOCK_ID = "merge-videos";

const mergeVideoWithCache = withCache(
    BLOCK_ID,
    async (
        params: VideoProcessorInputs,
        context: Context<VideoProcessorInputs, VideoProcessorOutputs>,
        resumeData?: any
    ): Promise<VideoProcessorOutputs> => {
        const { audioAssets, subtitleAssets, videoAssets } = params;

        const sources: SourceItem[] = [];

        for (let i = 0; i < videoAssets.length; i++) {
            const source: SourceItem = {
                id: videoAssets[i].id,
                duration: videoAssets[i].duration,
                audioAsset: audioAssets?.[i],
                subtitleAsset: subtitleAssets?.[i]
            };
            sources.push(source);
        }

        const { processor, cleanup } = await createCachedVideoProcessor(context, BLOCK_ID);

        try {
            return await processor.processVideo(params, sources, resumeData);
        } finally {
            // await cleanup();
        }
    }
);

export default mergeVideoWithCache;

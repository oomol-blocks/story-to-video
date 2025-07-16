import type { Context } from "@oomol/types/oocana";
import { AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";
import { withCache, WorkflowCacheManager } from "~/utils/Cache";
import { CachedAudioGenerator } from "~/cache/CacheAudioGenerator";

const BLOCK_ID = "generate-audio-with-ai";

const generateAudioWithCache = withCache(
    BLOCK_ID,
    async (
        params: AudioGeneratorInputs,
        context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
        cacheManager: WorkflowCacheManager,
        resumeData?: any
    ): Promise<AudioGeneratorOutputs> => {
        const cachedGenerator = new CachedAudioGenerator(context, cacheManager, BLOCK_ID);
        return await cachedGenerator.generateAudio(params, resumeData);
    }
);

export default generateAudioWithCache;

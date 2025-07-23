import type { Context } from "@oomol/types/oocana";
import { AudioGeneratorInputs, AudioGeneratorOutputs } from "~/core/AudioGenerator";
import { CacheManager, withCache } from "~/cache/CacheManager";
import { CachedAudioGenerator } from "~/cache/audio";

const BLOCK_ID = "generate-audio-with-ai";

const generateAudioWithCache = withCache(
    BLOCK_ID,
    async (
        params: AudioGeneratorInputs,
        context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
        cacheManager: CacheManager,
        resumeData?: any
    ): Promise<AudioGeneratorOutputs> => {
        const generator = new CachedAudioGenerator(context, cacheManager, BLOCK_ID);
        return await generator.generateAudio(params, resumeData);
    }
);

export default generateAudioWithCache;

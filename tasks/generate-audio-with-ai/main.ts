import type { Context } from "@oomol/types/oocana";
import { AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";
import { withCache } from "~/cache/CacheManager";
import { createCachedAudioGenerator } from "~/cache/audio";

const BLOCK_ID = "generate-audio-with-ai";

const generateAudioWithCache = withCache(
    BLOCK_ID,
    async (
        params: AudioGeneratorInputs,
        context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
        resumeData?: any
    ): Promise<AudioGeneratorOutputs> => {
        const { generator, cleanup } = await createCachedAudioGenerator(context, BLOCK_ID);
        
        try {
            return await generator.generateAudio(params, resumeData);
        } finally {
            // await cleanup();
        }
    }
);

export default generateAudioWithCache;

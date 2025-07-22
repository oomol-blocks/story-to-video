import type { Context } from "@oomol/types/oocana";
import { SubtitleConfig } from "~/utils/constants";
import { SubtitleGeneratorInputs, SubtitleGeneratorOutputs } from "~/utils/SubtitleGenerator";
import { withCache } from "~/cache/CacheManager";
import { createCachedSubtitleGenerator } from "~/cache/subtitle";

const BLOCK_ID = "generate-subtitles";

const generateSubtitlesWithCache = withCache(
    BLOCK_ID,
    async (
        params: SubtitleGeneratorInputs,
        context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>,
        resumeData?: any
    ): Promise<SubtitleGeneratorOutputs> => {
        const config: SubtitleConfig = {
            language: "zh-CN",
            fontSize: 18,
            position: "bottom",
            encoding: "utf8",
            format: "ass"
        };

        const { generator, cleanup } = await createCachedSubtitleGenerator(context, BLOCK_ID);

        try {
            return await generator.generateSubtitles(params, config, resumeData);
        } finally {
            // await cleanup(); // Commented out to avoid premature cleanup
        }
    }
);

export default generateSubtitlesWithCache;

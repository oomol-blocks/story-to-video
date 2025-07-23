import type { Context } from "@oomol/types/oocana";
import { SubtitleConfig } from "~/utils/constants";
import { SubtitleGeneratorInputs, SubtitleGeneratorOutputs } from "~/core/SubtitleGenerator";
import { CacheManager, withCache } from "~/cache/CacheManager";
import { CachedSubtitleGenerator } from "~/cache/subtitle";

const BLOCK_ID = "generate-subtitles";

const generateSubtitlesWithCache = withCache(
    BLOCK_ID,
    async (
        params: SubtitleGeneratorInputs,
        context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>,
        cacheManager: CacheManager,
        resumeData?: any
    ): Promise<SubtitleGeneratorOutputs> => {
        const config: SubtitleConfig = {
            language: "zh-CN",
            fontSize: 18,
            position: "bottom",
            encoding: "utf8",
            format: "ass"
        };

        const generator = new CachedSubtitleGenerator(context, cacheManager, BLOCK_ID);
        return await generator.generateSubtitles(params, config, resumeData);
    }
);

export default generateSubtitlesWithCache;

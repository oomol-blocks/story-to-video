import type { Context } from "@oomol/types/oocana";
import { SubtitleConfig } from "~/utils/constants";
import { SubtitleGenerator, SubtitleGeneratorInputs, SubtitleGeneratorOutputs } from "~/utils/SubtitleGenerator";

export default async function generateSubtitles(
    params: SubtitleGeneratorInputs,
    context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>
): Promise<SubtitleGeneratorOutputs> {
    const config = {
        language: "zh-CN",
        fontSize: 18,
        position: "bottom",
        encoding: "utf8",
        format: "ass"
    } as SubtitleConfig;
    
    const generator = new SubtitleGenerator(context);
    return await generator.generateSubtitles(params, config);
}

import type { Context } from "@oomol/types/oocana";
import { SubtitleGenerator, SubtitleGeneratorInputs, SubtitleGeneratorOutputs } from "~/utils/SubtitleGenerator";

export default async function generateSubtitles(
    params: SubtitleGeneratorInputs,
    context: Context<SubtitleGeneratorInputs, SubtitleGeneratorOutputs>
): Promise<SubtitleGeneratorOutputs> {
    const generator = new SubtitleGenerator();
    return await generator.generateSubtitles(params, context);
}

import type { Context } from "@oomol/types/oocana";
import { AudioGenerator, AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";

export default async function generateAudio(
    params: AudioGeneratorInputs,
    context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>
): Promise<AudioGeneratorOutputs> {
    const generator = new AudioGenerator();
    return await generator.generateAudio(params, context);
}

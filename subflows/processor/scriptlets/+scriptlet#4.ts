import type { Context } from "@oomol/types/oocana";
import { DoubaoVideoGenerator, VideoGeneratorInputs, VideoGeneratorOutputs } from "~/utils/VideoGenerator";

export default async function generateVideo(
    params: VideoGeneratorInputs,
    context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>
): Promise<VideoGeneratorOutputs> {
    const generator = new DoubaoVideoGenerator();
    return await generator.generateVideo(params, context);
}

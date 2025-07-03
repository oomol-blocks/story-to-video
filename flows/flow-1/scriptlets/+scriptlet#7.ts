import type { Context } from "@oomol/types/oocana";
import { VideoGenerator, VideoGeneratorInputs, VideoGeneratorOutputs } from "~/utils/VideoGenerator";

export default async function generateVideo(
    params: VideoGeneratorInputs,
    context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>
): Promise<VideoGeneratorOutputs> {
    const generator = new VideoGenerator();
    return await generator.generateVideo(params, context);
}

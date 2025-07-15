import type { Context } from "@oomol/types/oocana";
import { ImageGeneratorInputs, ImageGeneratorOutputs, ImageGenerator } from "~/utils/ImageGenarator";

export default async function generateImages(
    params: ImageGeneratorInputs,
    context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
): Promise<ImageGeneratorOutputs> {
    const generator = new ImageGenerator(context);
    return await generator.generateImages(params);
}

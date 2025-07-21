import type { Context } from "@oomol/types/oocana";
import { ImageGeneratorInputs, ImageGeneratorOutputs } from "~/utils/ImageGenarator";
import { withCache } from "~/cache/CacheManager";
import { createCachedImageGenerator } from "~/cache/image";

const BLOCK_ID = "generate-images-with-ai";

const generateImagesWithCache = withCache(
    BLOCK_ID,
    async (
        params: ImageGeneratorInputs,
        context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
        resumeData?: any
    ): Promise<ImageGeneratorOutputs> => {
        const { generator, cleanup } = await createCachedImageGenerator(context, BLOCK_ID);

        try {
            return await generator.generateImages(params, resumeData);
        } finally {
            // await cleanup();
        }
    }
);

export default generateImagesWithCache;

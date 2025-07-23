import type { Context } from "@oomol/types/oocana";
import { ImageGeneratorInputs, ImageGeneratorOutputs } from "~/core/ImageGenarator";
import { CacheManager, withCache } from "~/cache/CacheManager";
import { CachedImageGenerator } from "~/cache/image";

const BLOCK_ID = "generate-images-with-ai";

const generateImagesWithCache = withCache(
    BLOCK_ID,
    async (
        params: ImageGeneratorInputs,
        context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
        cacheManager: CacheManager,
        resumeData?: any
    ): Promise<ImageGeneratorOutputs> => {
        const generator = new CachedImageGenerator(context, cacheManager, BLOCK_ID);
        return await generator.generateImages(params, resumeData);
    }
);

export default generateImagesWithCache;

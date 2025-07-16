import type { Context } from "@oomol/types/oocana";
import { ImageGeneratorInputs, ImageGeneratorOutputs } from "~/utils/ImageGenarator";
import { withCache, WorkflowCacheManager } from "~/utils/Cache";
import { CachedImageGenerator } from "~/cache/CacheImageGenerator";

const BLOCK_ID = "generate-images-with-ai";

const generateImagesWithCache = withCache(
    BLOCK_ID,
    async (
        params: ImageGeneratorInputs,
        context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>,
        cacheManager: WorkflowCacheManager,
        resumeData?: any
    ): Promise<ImageGeneratorOutputs> => {
        const cachedGenerator = new CachedImageGenerator(context, cacheManager, BLOCK_ID);
        return await cachedGenerator.generateImages(params, resumeData);
    }
);

export default generateImagesWithCache;

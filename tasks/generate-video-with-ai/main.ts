import type { Context } from "@oomol/types/oocana";
import { VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/core/VideoGenerator";
import { CacheManager, withCache } from "~/cache/CacheManager";
import { CachedVideoGenerator } from "~/cache/video";

const BLOCK_ID = "generate-video-with-ai";

type VideoGeneratorParams = Omit<VideoGeneratorInputs, "imageAssets"> & { imageList: string[] };

const generateVideoWithCache = withCache(
    BLOCK_ID,
    async (
        params: VideoGeneratorParams,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        cacheManager: CacheManager,
        resumeData?: any
    ): Promise<VideoGeneratorOutputs> => {

        const { imageList } = params
        let { durationList } = params;

        if (!imageList || !imageList.length) {
            throw new Error("imageList is required")
        }

        const imageAssets = await Promise.all(
            imageList
                .sort() // 按文件名排序
                .map(async (filePath, index) => {
                    const ext = filePath.split('.').pop();
                    const { width, height } = await getImageWidthAndHeight(filePath);

                    return {
                        id: `image_${index + 1}`,
                        url: filePath,
                        filePath: filePath,
                        fileSize: null,
                        width,
                        height,
                        format: ext === 'jpg' ? 'jpeg' : ext,
                        prompt: "",
                        style: "",
                        createdAt: new Date()
                    };
                })
        );

        // 补全 durationList，默认每段 5 秒
        if (!durationList || durationList.length === 0) {
            durationList = imageAssets.map((imageAsset) => ({
                id: imageAsset.id,
                duration: 5
            }));
        }

        // 构建 segments
        const segments: Segment[] = [];
        for (let i = 0; i < imageAssets.length; i++) {
            const segment: Segment = {
                id: imageAssets[i].id,
                imageAsset: imageAssets[i],
                nextImageAsset: i < imageAssets.length - 1 ? imageAssets[i + 1] : undefined,
                duration: durationList[i].duration
            };
            segments.push(segment);
        }

        const generator = new CachedVideoGenerator(context, cacheManager, BLOCK_ID);
        const _params = { ...params, imageAssets } as VideoGeneratorInputs;
        return await generator.generateVideo(_params, segments, resumeData);
    }
);

export default generateVideoWithCache;

const getImageWidthAndHeight = async (imageUrl: string) => {
    try {
        const fs = await import('node:fs/promises');
        const imageSize = await import('image-size');
        
        let buffer: Buffer;
        
        // 判断是本地路径还是 HTTP URL
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            // HTTP URL - 下载为 buffer
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        } else {
            // 本地文件路径 - 读取为 buffer
            buffer = await fs.readFile(imageUrl);
        }
        
        // 使用 image-size 解析 buffer
        const dimensions = imageSize.default(buffer);
        return { 
            width: dimensions.width || 0, 
            height: dimensions.height || 0 
        };
    } catch (error) {
        throw new Error(`Failed to get image dimensions from ${imageUrl}: ${error.message}`);
    }
};
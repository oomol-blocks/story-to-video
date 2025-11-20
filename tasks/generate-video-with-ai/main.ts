import type { Context } from "@oomol/types/oocana";
import { VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/core/VideoGenerator";
import { CacheManager, withCache } from "~/cache/CacheManager";
import { CachedVideoGenerator } from "~/cache/video";

const BLOCK_ID = "generate-video-with-ai";

const generateVideoWithCache = withCache(
    BLOCK_ID,
    async (
        params: VideoGeneratorInputs,
        context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        cacheManager: CacheManager,
        resumeData?: any
    ): Promise<VideoGeneratorOutputs> => {
        const { imageAssets } = params;
        let { durationList } = params;

        // 补全 imageAsset 的默认属性
        for (const imageAsset of imageAssets) {
            // 补全尺寸
            if (!imageAsset.width || !imageAsset.height) {
                const { width, height } = await getImageWidthAndHeight(imageAsset.url);
                if (!imageAsset.width) {
                    imageAsset.width = width;
                }
                if (!imageAsset.height) {
                    imageAsset.height = height;
                }
            }
            
            // 补全其他默认属性
            if (!imageAsset.id) {
                imageAsset.id = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            if (!imageAsset.prompt) {
                imageAsset.prompt = "";
            }
            if (!imageAsset.style) {
                imageAsset.style = "";
            }
            if (!imageAsset.filePath) {
                imageAsset.filePath = "";
            }
            if (!imageAsset.format) {
                imageAsset.format = "png";
            }
            if (!imageAsset.createdAt) {
                imageAsset.createdAt = new Date();
            }
        }

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
        return await generator.generateVideo(params, segments, resumeData);
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
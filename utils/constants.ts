// 生成的图片尺寸
export const DallE3ImageSize = {
    /** 正方形 - 1024x1024 (1:1 宽高比) */
    SQUARE: "1024x1024",
    /** 横向长方形 - 1792x1024 (约16:9 宽高比) */
    LANDSCAPE: "1792x1024",
    /** 纵向长方形 - 1024x1792 (约9:16 宽高比) */
    PORTRAIT: "1024x1792"
} as const;

export type DallE3ImageSizeType = typeof DallE3ImageSize[keyof typeof DallE3ImageSize];

const VALID_DALLE3_SIZES = new Set(Object.values(DallE3ImageSize));

export function isValidDallE3ImageSize3(size: string): size is DallE3ImageSizeType {
    return VALID_DALLE3_SIZES.has(size as DallE3ImageSizeType);
}

export const VideoSize = {
    /** 正方形 - 1080x1080 (1:1 宽高比) */
    SQUARE: "1080x1080",
    /** 横向长方形 - 1920x1080 (16:9 宽高比) */
    LANDSCAPE: "1920x1080",
    /** 纵向长方形 - 1080x1920 (9:16 宽高比) */
    PORTRAIT: "1080x1920"
} as const;

export type VideoSizeType = typeof VideoSize[keyof typeof VideoSize];

export function isValidVideoSize(size: string): size is VideoSizeType {
    return Object.values(VideoSize).includes(size as VideoSizeType);
}

/**
 * 视频尺寸到 DALL-E 3 图像尺寸的映射
 * 根据宽高比进行映射：
 * - 1:1 (正方形) -> 1024x1024
 * - 16:9 (横屏) -> 1792x1024  
 * - 9:16 (竖屏) -> 1024x1792
 */
const VIDEO_TO_DALLE3_SIZE_MAP: Record<VideoSizeType, DallE3ImageSizeType> = {
    [VideoSize.SQUARE]: DallE3ImageSize.SQUARE,       // 1080x1080 -> 1024x1024
    [VideoSize.LANDSCAPE]: DallE3ImageSize.LANDSCAPE, // 1920x1080 -> 1792x1024
    [VideoSize.PORTRAIT]: DallE3ImageSize.PORTRAIT    // 1080x1920 -> 1024x1792
} as const;

export function getImageSizeFromVideoSize(videoSize: VideoSizeType): DallE3ImageSizeType {
    return VIDEO_TO_DALLE3_SIZE_MAP[videoSize];
}

export interface VideoParams {
    resolution: string;
    framerate: number;
    crf: number;
    preset: string;
    bitrate: string;
    scaleFilter?: string;
}

export const VideoParamsMap: Record<string, VideoParams> = {
    [DallE3ImageSize.SQUARE]: {
        resolution: VideoSize.SQUARE,
        framerate: 25,
        crf: 23,
        preset: "medium",
        bitrate: "2M",
        scaleFilter: "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:-1:-1:black"
    },
    [DallE3ImageSize.LANDSCAPE]: {
        resolution: VideoSize.LANDSCAPE,
        framerate: 30,
        crf: 21,
        preset: "medium",
        bitrate: "4M",
        scaleFilter: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:black"
    },
    [DallE3ImageSize.PORTRAIT]: {
        resolution: VideoSize.PORTRAIT,
        framerate: 30,
        crf: 22,
        preset: "medium",
        bitrate: "3M",
        scaleFilter: "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1:black"
    }
};

// 解析尺寸字符串
export function parseResolution(resolution: string): { width: number; height: number } {
    const [width, height] = resolution.split('x').map(Number);
    return { width, height };
}

// 根据图片尺寸获取视频参数
export function getVideoParamsFromImageSize(imageSize: string): VideoParams {
    const params = VideoParamsMap[imageSize];
    if (!params) {
        console.warn(`Unknown image size: ${imageSize}, using default portrait（${DallE3ImageSize.PORTRAIT}） params`);
        return VideoParamsMap[DallE3ImageSize.PORTRAIT];
    }
    return params;
}

// 获取宽高比类型
export function getAspectRatioType(resolution: string): 'square' | 'landscape' | 'portrait' {
    const { width, height } = parseResolution(resolution);
    
    if (width === height) {
        return 'square';
    } else if (width > height) {
        return 'landscape';
    } else {
        return 'portrait';
    }
}

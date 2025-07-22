export interface BaseAsset {
    id: string;
    createdAt: Date;
    metadata?: Record<string, any>;
}

export interface TimingInfo {
    startTime: number;
    endTime: number;
    duration: number;
}

export interface MediaAsset extends BaseAsset {
    filePath: string;
    fileSize: number;
    format: string;
}

export interface AudioConfig {
    apiEndpoint: string;
    apiKey: string;
    // 根据模型内部判断，不暴露给用户
    requestFormat: 'form' | 'json'
    model: string;
    voice: string;
    speed: number;
    format: 'mp3' | 'wav' | 'aac';
    sampleRate: number;
    // bitRate: number;
}

export interface ImageConfig {
    apiEndpoint: string;
    apiKey: string;
    // 根据模型自行判断，不暴露给用户
    requestFormat: 'form' | 'json'
    model: string;
    size: string;
    style: string;
    quality: 'standard' | 'hd';
    format: 'png' | 'jpg' | 'webp';
    watermark: boolean;
}

export interface SubtitleConfig {
    language: string;
    fontSize: number;
    fontFamily?: string;
    position: 'bottom' | 'top' | 'center';
    encoding: 'utf8' | 'gbk';
    format: 'srt' | 'ass' | 'vtt';
}

export interface VideoConfig {
    apiEndpoint: string;
    apiKey: string;
    size: string;
    // frameRate: number;
    // codec: 'h264' | 'h265';
    // bitRate: number;
    format: 'mp4';
}

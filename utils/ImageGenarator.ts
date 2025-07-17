import * as fs from "node:fs/promises";
import { Context } from "@oomol/types/oocana";

import { ImageConfig, MediaAsset } from "./constants";

export interface ImageAsset extends MediaAsset {
    width: number;
    height: number;
    prompt: string;
    style: string;
    url: string;
}

export interface ImageGeneratorInputs {
    prompts: Array<{
        id: string;
        content: string;
        style?: string;
    }>;
    config: ImageConfig;
    outputDir?: string;
}

export interface ImageGeneratorOutputs {
    imageAssets: ImageAsset[];
}

export class ImageGenerator {
    constructor(
        private context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
    ) { }

    async generateImages(
        params: ImageGeneratorInputs
    ): Promise<ImageGeneratorOutputs> {
        this.context.reportLog('Generating images...', "stdout");

        const { prompts, config, outputDir } = params;
        const imageAssets: ImageAsset[] = [];

        await this.ensureDirectory(outputDir);

        for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];
            this.context.reportLog(`Generating image ${i + 1}/${prompts.length}`, "stdout");

            const imageAsset = await this.generateSingleImage(prompt, config, outputDir);
            imageAssets.push(imageAsset);

            this.context.reportProgress((i + 1) / prompts.length * 100);
        }

        return { imageAssets }
    }

    async generateSingleImage(
        prompt: { id: string; content: string; style?: string; },
        config: ImageConfig,
        outputPath: string
    ): Promise<ImageAsset> {
        const imageUrl = await this.callImageAPI(prompt.content, config);
        // TODO: 模型返回的 format 和目标 config 可能不一致
        await this.downloadImage(imageUrl, outputPath);

        const imageInfo = await this.getImageInfo(outputPath);

        return {
            id: prompt.id,
            url: imageUrl,
            filePath: outputPath,
            width: imageInfo.width,
            height: imageInfo.height,
            prompt: prompt.content,
            style: prompt.style || config.style,
            fileSize: imageInfo.fileSize,
            format: config.format,
            createdAt: new Date()
        };
    }

    private async callImageAPI(
        prompt: string, config: ImageConfig
    ): Promise<string> {
        const requestFormat = config.requestFormat || 'json';
        let body: string | URLSearchParams;
        let headers: Record<string, string>;

        if (requestFormat === 'json') {
            // JSON 格式请求
            const requestBody = {
                prompt: prompt,
                model: config.model,
                size: config.size,
                response_format: "url",
                watermark: config.watermark || false,
                quality: config.quality || "standard",
                style: config.style || "vivid"
            };

            body = JSON.stringify(requestBody);
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            };
        } else {
            // Form 格式请求
            const urlencoded = new URLSearchParams();
            urlencoded.append("prompt", prompt);
            urlencoded.append("model", config.model);
            urlencoded.append("size", config.size);
            urlencoded.append("response_format", "url");
            urlencoded.append("watermark", (config.watermark || false).toString());
            urlencoded.append("quality", config.quality || "standard");
            urlencoded.append("style", config.style || "vivid");

            body = urlencoded;
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${config.apiKey}`
            };
        }

        const response = await fetch(config.apiEndpoint, {
            method: 'POST',
            body,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image generation API failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const imageUrl = result?.data?.[0]?.url;

        if (!imageUrl) {
            throw new Error('No image URL in API response');
        }

        return imageUrl;
    }

    private async downloadImage(url: string, filePath: string): Promise<void> {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
            }

            const imageBuffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(imageBuffer));
        } catch (error) {
            throw new Error(`Failed to download image from ${url}: ${error}`);
        }
    }

    private async getImageInfo(filePath: string): Promise<{ width: number; height: number; fileSize: number }> {
        try {
            // 获取文件大小
            const stats = await fs.stat(filePath);
            const fileSize = stats.size;

            // 获取图片尺寸
            const { width, height } = await this.getImageDimensions(filePath);

            return { width, height, fileSize };
        } catch (error) {
            throw new Error(`Failed to get image info for ${filePath}: ${error}`);
        }
    }

    private async getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
        try {
            // 读取图片文件的头部信息来获取尺寸
            const buffer = await fs.readFile(filePath);

            // 根据文件格式解析尺寸
            if (this.isPNG(buffer)) {
                return this.parsePNGDimensions(buffer);
            } else if (this.isJPEG(buffer)) {
                return this.parseJPEGDimensions(buffer);
            } else if (this.isWebP(buffer)) {
                return this.parseWebPDimensions(buffer);
            } else {
                // 如果无法识别格式，返回默认值
                this.context.reportLog(`Warning: Unable to determine image format for ${filePath}, using default dimensions`, "stderr");
                return { width: 1024, height: 1024 };
            }
        } catch (error) {
            throw new Error(`Failed to get image dimensions: ${error}`);
        }
    }

    private isPNG(buffer: Buffer): boolean {
        return buffer.length >= 8 &&
            buffer[0] === 0x89 && buffer[1] === 0x50 &&
            buffer[2] === 0x4E && buffer[3] === 0x47;
    }

    private isJPEG(buffer: Buffer): boolean {
        return buffer.length >= 2 &&
            buffer[0] === 0xFF && buffer[1] === 0xD8;
    }

    private isWebP(buffer: Buffer): boolean {
        return buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    private parsePNGDimensions(buffer: Buffer): { width: number; height: number } {
        // PNG 格式：宽度在字节 16-19，高度在字节 20-23
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
    }

    private parseJPEGDimensions(buffer: Buffer): { width: number; height: number } {
        // JPEG 格式比较复杂，这里简化处理
        let offset = 2;

        while (offset < buffer.length) {
            const marker = buffer.readUInt16BE(offset);

            if (marker === 0xFFC0 || marker === 0xFFC2) {
                // SOF0 或 SOF2 marker
                const height = buffer.readUInt16BE(offset + 5);
                const width = buffer.readUInt16BE(offset + 7);
                return { width, height };
            }

            const length = buffer.readUInt16BE(offset + 2);
            offset += 2 + length;
        }

        throw new Error('Unable to find JPEG dimensions');
    }

    private parseWebPDimensions(buffer: Buffer): { width: number; height: number } {
        // WebP 格式的简化解析
        if (buffer.toString('ascii', 12, 16) === 'VP8 ') {
            // VP8 格式
            const width = buffer.readUInt16LE(26) & 0x3FFF;
            const height = buffer.readUInt16LE(28) & 0x3FFF;
            return { width, height };
        } else if (buffer.toString('ascii', 12, 16) === 'VP8L') {
            // VP8L 格式
            const bits = buffer.readUInt32LE(21);
            const width = (bits & 0x3FFF) + 1;
            const height = ((bits >> 14) & 0x3FFF) + 1;
            return { width, height };
        }

        throw new Error('Unsupported WebP format');
    }

    private async ensureDirectory(dir: string) {
        return await fs.mkdir(dir, { recursive: true });
    }
}

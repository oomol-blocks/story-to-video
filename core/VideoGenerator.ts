import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { FFmpegExecutor } from "./FFmpegExcutor";
import { ImageAsset } from "./ImageGenarator";
import { MediaAsset, VideoConfig } from "../utils/constants";

export interface VideoAsset extends MediaAsset {
    duration: number;
    resolution: string;
}

export interface VideoGeneratorInputs {
    imageAssets: ImageAsset[];
    durationList: {
        id: string;
        duration: number;
    }[]; // 提供精确时长
    config: VideoConfig;
    outputDir?: string;
}

export interface Segment {
    id: string;
    duration: number;
    imageAsset: ImageAsset;
    nextImageAsset?: ImageAsset;
}

export interface VideoGeneratorOutputs {
    videoAssets: VideoAsset[];
}

export class DoubaoVideoGenerator extends FFmpegExecutor {
    private apiEndpoint = "https://llm.oomol.com/v1";
    private model = "doubao-seedance-1-0-lite-i2v-250428";
    private apiKey: string;

    constructor(private context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>) {
        super();
    }

    private getApiPaths(apiEndpoint: string) {
        return {
            createTask: `${apiEndpoint}/video/generations`,
            getTask: `${apiEndpoint}/video/generations`
        };
    }

    async generateVideoSegment(
        segment: Segment,
        config: VideoConfig,
        outputPath: string
    ): Promise<VideoAsset> {
        // use OOMOL Token
        this.apiKey = await this.context.getOomolToken();

        try {
            const videoUrl = await this.callVideoAPI(segment, config);
            await this.downloadVideo(videoUrl, outputPath);

            // get the duration of the downloaded video
            const videoInfo = await this.getVideoInfo(outputPath);

            const videoAsset: VideoAsset = {
                id: segment.id,
                filePath: outputPath,
                duration: videoInfo.duration,
                resolution: config.size || "1280x720",
                fileSize: videoInfo.fileSize,
                format: config.format || "mp4",
                createdAt: new Date()
            };

            return videoAsset;
        } catch (error) {
            throw error;
        }
    }

    private async callVideoAPI(segment: Segment, config: VideoConfig): Promise<string> {
        try {
            const duration = Math.ceil(segment.duration);
            const prompt = `${segment.imageAsset.prompt} --rs 720p --dur ${duration}`;

            const firstUrl = segment.imageAsset.url.startsWith("http")
                ? segment.imageAsset.url
                : await this.convertImageToBase64(segment.imageAsset.url);

            const content = [
                {
                    type: "text",
                    text: prompt
                },
                {
                    type: "image_url",
                    image_url: {
                        url: firstUrl
                    },
                    role: "first_frame"
                }
            ];

            if (segment.nextImageAsset) {
                const secondUrl = segment.nextImageAsset.url.startsWith("http")
                    ? segment.nextImageAsset.url
                    : await this.convertImageToBase64(segment.nextImageAsset.url);

                content.push({
                    type: "image_url",
                    image_url: {
                        url: secondUrl
                    },
                    role: "last_frame"
                });
            }

            const taskCreateRequest = {
                model: this.model,
                content
            };

            const createResponse = await this.createDoubaoTask(taskCreateRequest);
            this.context.reportLog(`Task created: ${createResponse.id}`, "stdout");

            const videoUrl = await this.pollTaskStatus(createResponse.id);
            this.context.reportLog(`Video generated: ${videoUrl}`, "stdout");

            return videoUrl;
        } catch (error) {
            throw new Error(`Failed to call video API: ${error.message}`);
        }
    }

    private async downloadVideo(url: string, filePath: string): Promise<void> {
        this.context.reportLog(`Downloading video from: ${url}`, "stdout");

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download video: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));

            this.context.reportLog(`✓ Video downloaded to: ${filePath}`, "stdout");
        } catch (error) {
            throw new Error(`Failed to download video: ${error.message}`);
        }
    }

    private async createDoubaoTask(request: any): Promise<any> {
        const paths = this.getApiPaths(this.apiEndpoint);

        const response = await fetch(paths.createTask, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create Doubao task: ${response.status} ${errorText}`);
        }

        return await response.json();
    }

    private async convertImageToBase64(imagePath: string): Promise<string> {
        try {
            const buffer = await fs.readFile(imagePath);
            const ext = path.extname(imagePath).toLowerCase().substring(1);

            // 确定 MIME 类型
            const mimeTypes: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp'
            };

            const mimeType = mimeTypes[ext] || 'image/jpeg';
            const base64 = buffer.toString('base64');

            return `data:${mimeType};base64,${base64}`;
        } catch (error) {
            throw new Error(`Failed to convert image to base64: ${error.message}`);
        }
    }

    private async pollTaskStatus(taskId: string): Promise<string> {
        const paths = this.getApiPaths(this.apiEndpoint);
        const maxAttempts = 60;
        const pollInterval = 10000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`${paths.getTask}/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get task status: ${response.status} ${errorText}`);
            }

            const taskResponse = await response.json();
            this.context.reportLog(`Task ${taskId} status: ${taskResponse.status}`, "stdout");

            if (taskResponse.status === 'succeeded') {
                if (!taskResponse.content?.video_url) {
                    throw new Error('Video URL not found in completed task');
                }
                return taskResponse.content.video_url;
            } else if (taskResponse.status === 'failed') {
                throw new Error(`Task failed: ${taskResponse.error}`);
            } else if (taskResponse.status === 'cancelled') {
                throw new Error('Task was cancelled');
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
    }
}

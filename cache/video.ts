import type { Context } from "@oomol/types/oocana";
import path from "path";

import { DoubaoVideoGenerator, VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/core/VideoGenerator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { VideoFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";


export class CachedVideoGenerator {
    private stepCache: StepCache;
    private generator: DoubaoVideoGenerator;
    private videoFileManager: VideoFileManager;
    private fileManager: FileManager;
    private initPromise: Promise<void>;

    constructor(
        private context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        private cacheManager: CacheManager,
        BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new DoubaoVideoGenerator(context);

        this.initPromise = this.doInitialize();
    }

    private async doInitialize(): Promise<void> {
        try {
            this.fileManager = new FileManager(this.context, this.cacheManager);
            await this.fileManager.initialize();

            this.videoFileManager = new VideoFileManager(this.fileManager);
        } catch (error) {
            throw new Error(`Failed to initialize CachedAudioGenerator: ${error.message}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
        if (!this.fileManager || !this.videoFileManager) {
            throw new Error('CachedVideoGenerator initialization failed');
        }
    }

    /**
     * 生成视频
     */
    async generateVideo(params: VideoGeneratorInputs, segments: Segment[], resumeData?: any): Promise<VideoGeneratorOutputs> {
        await this.ensureInitialized();
        this.context.reportLog('Generating video segments...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, segments, resumeData);

        try {
            // 生成剩余的视频段
            await this.generateRemainingVideoSegments(params, segments, state);

            // 返回结果
            return this.buildResult(state);
        } catch (error) {
            // 保存当前状态
            await this.cacheManager.updateProgress((state.startIndex / segments.length) * 80, {
                videoAssets: state.videoAssets,
                currentSegmentIndex: state.startIndex,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * 初始化生成状态
     */
    private initializeState(params: VideoGeneratorInputs, segments: Segment[], resumeData?: any) {
        const videoAssets = resumeData?.videoAssets || [];
        const tempVideoFiles = resumeData?.tempVideoFiles || [];
        const startIndex = videoAssets.length;

        if (startIndex > 0) {
            this.context.reportLog(
                `Resuming video generation from segment ${startIndex + 1}/${segments.length}`,
                "stdout"
            );
        }

        return {
            videoAssets,
            tempVideoFiles,
            startIndex,
            totalSegments: segments.length
        };
    }

    /**
     * 生成剩余的视频段
     */
    private async generateRemainingVideoSegments(params: VideoGeneratorInputs, segments: Segment[], state: any) {
        for (let i = state.startIndex; i < segments.length; i++) {
            const segment = segments[i];

            // 生成单个视频段
            const videoAsset = await this.generateVideoSegmentCached(segment, params);

            // 更新状态
            state.videoAssets.push(videoAsset);

            // 保存进度
            await this.saveProgress(i + 1, segments.length, state, 80); // 80% for generation
        }
    }

    /**
     * 生成单个视频段
     */
    private async generateVideoSegmentCached(
        segment: Segment,
        params: VideoGeneratorInputs
    ) {
        if (params.outputDir) {
            const tempPath = path.join(params.outputDir, `temp_video_${segment.id}.${params.config.format || "mp4"}`);

            return await this.stepCache.executeStep(
                `video-segment-${segment.id}`,
                async () => await this.generator.generateVideoSegment(
                    segment,
                    params.config,
                    tempPath
                ),
                `Generate video segment ${segment.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器
            const { videoAsset } = await this.generateVideoSegmentWithFile(segment, params);
            return videoAsset;
        }
    }

    private async generateVideoSegmentWithFile(
        segment: Segment,
        params: VideoGeneratorInputs
    ) {
        return await this.stepCache.executeStepWithFiles(
            `video-segment-${segment.id}`,
            async () => {
                // 创建临时视频文件管理记录
                const tempManagedFile = await this.videoFileManager.createTempVideoFile(
                    segment.id,
                    params.config.format || "mp4"
                );

                try {
                    // 更新状态
                    await this.fileManager.updateFileStatus(tempManagedFile.id, FileStatus.PROCESSING);
                    // 调用生成器生成视频段
                    const videoAsset = await this.generator.generateVideoSegment(
                        segment,
                        params.config,
                        tempManagedFile.tempPath!
                    );

                    // 更新文件状态
                    await this.fileManager.updateFileStatus(tempManagedFile.id, FileStatus.COMPLETED);

                    return {
                        result: {
                            videoAsset
                        },
                        fileIds: [tempManagedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(tempManagedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            `Generate video segment ${segment.id}`
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any, maxProgress: number = 100) {
        const progress = (completed / total) * maxProgress;

        await this.cacheManager.updateProgress(progress, {
            videoAssets: [...state.videoAssets],
            currentSegmentIndex: completed
        });

        await this.context.reportProgress(progress);
    }

    private buildResult(state: any): VideoGeneratorOutputs {
        this.context.reportLog('✓ Video generation completed successfully', 'stdout');

        return {
            videoAssets: state.videoAssets
        };
    }

    async destroy(): Promise<void> {
        await this.initPromise;
        if (this.fileManager) {
            await this.fileManager.destroy();
        }
    }
}

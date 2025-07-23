import type { Context } from "@oomol/types/oocana";
import path from "path";

import { SourceItem, VideoProcessor, VideoProcessorInputs, VideoProcessorOutputs } from "~/core/VideoProcessor";
import { VideoAsset } from "~/core/VideoGenerator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { VideoFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";

export class CachedVideoProcessor {
    private stepCache: StepCache;
    private processor: VideoProcessor;
    private videoFileManager: VideoFileManager;
    private fileManager: FileManager;
    private initPromise: Promise<void>;

    constructor(
        private context: Context<VideoProcessorInputs, VideoProcessorOutputs>,
        private cacheManager: CacheManager,
        BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.processor = new VideoProcessor(context);

        this.initPromise = this.doInitialize();
    }

    private async doInitialize(): Promise<void> {
        try {
            this.fileManager = new FileManager(this.context, this.cacheManager);
            await this.fileManager.initialize();

            this.videoFileManager = new VideoFileManager(this.fileManager);
        } catch (error) {
            throw new Error(`Failed to initialize CachedVideoProcessor: ${error.message}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
        if (!this.fileManager || !this.videoFileManager) {
            throw new Error('CachedVideoProcessor initialization failed');
        }
    }

    /**
     * 处理视频段（添加音频和字幕）
     */
    async processVideo(
        params: VideoProcessorInputs,
        sources: SourceItem[],
        resumeData?: any
    ): Promise<VideoProcessorOutputs> {
        await this.ensureInitialized();
        this.context.reportLog('Processing video sources with audio and subtitles...', "stdout");

        const state = this.initializeProcessingState(params.videoAssets, resumeData);

        try {
            // 处理剩余的视频段
            await this.processRemainingVideoSources(params.videoAssets, sources, params, state);

            // 合并视频段
            const mergedVideoAsset = await this.mergeVideoSourcesCached(state.processedVideoAssets, params);

            return this.buildResult(state, mergedVideoAsset);
        } catch (error) {
            await this.cacheManager.updateProgress((state.startIndex / params.videoAssets.length) * 100, {
                processedVideoAssets: state.processedVideoAssets,
                currentSourceIndex: state.startIndex,
                error: error.message
            });
            throw error;
        }
    }

    private initializeProcessingState(rawVideoAssets: VideoAsset[], resumeData?: any) {
        const processedVideoAssets = resumeData?.processedVideoAssets || [];
        const startIndex = processedVideoAssets.length;

        if (startIndex > 0) {
            this.context.reportLog(
                `Resuming video processing from source ${startIndex + 1}/${rawVideoAssets.length}`,
                "stdout"
            );
        }

        return {
            processedVideoAssets,
            startIndex,
            totalSources: rawVideoAssets.length
        };
    }

    private async processRemainingVideoSources(
        rawVideoAssets: VideoAsset[],
        sources: SourceItem[],
        params: VideoProcessorInputs,
        state: any
    ) {
        for (let i = state.startIndex; i < rawVideoAssets.length; i++) {
            const rawVideoAsset = rawVideoAssets[i];
            const source = sources[i];

            // 处理单个视频段
            const processedVideoAsset = await this.processVideoSourceCached(rawVideoAsset, source, params);

            // 更新状态
            state.processedVideoAssets.push(processedVideoAsset);

            // 保存进度
            await this.saveProcessingProgress(i + 1, rawVideoAssets.length, state, 70); // 70% for processing
        }
    }

    private async processVideoSourceCached(
        rawVideoAsset: VideoAsset,
        source: SourceItem,
        params: VideoProcessorInputs
    ) {
        if (params.outputDir) {
            const outputPath = path.join(params.outputDir, 'video', `${source.id}.${params.config.format}`);

            return await this.stepCache.executeStep(
                `process-video-source-${source.id}`,
                async () => await this.processor.processVideoSource(
                    rawVideoAsset,
                    source,
                    params.config,
                    outputPath
                ),
                `Process video source ${source.id}`
            );
        } else {
            const { videoAsset } = await this.processVideoSourceWithFile(rawVideoAsset, source, params);
            return videoAsset;
        }
    }

    private async processVideoSourceWithFile(
        rawVideoAsset: VideoAsset,
        source: SourceItem,
        params: VideoProcessorInputs
    ) {
        return await this.stepCache.executeStepWithFiles(
            `process-video-source-${source.id}`,
            async () => {
                const processedManagedFile = await this.videoFileManager.createTempVideoFile(
                    `processing-${source.id}`,
                    params.config.format
                );

                try {
                    await this.fileManager.updateFileStatus(processedManagedFile.id, FileStatus.PROCESSING);

                    const processedVideoAsset = await this.processor.processVideoSource(
                        rawVideoAsset,
                        source,
                        params.config,
                        processedManagedFile.tempPath!
                    );

                    await this.fileManager.updateFileStatus(processedManagedFile.id, FileStatus.COMPLETED);

                    return {
                        result: {
                            videoAsset: processedVideoAsset,
                            tempFileId: processedManagedFile.id
                        },
                        fileIds: [processedManagedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(processedManagedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            `Process video source ${source.id}`
        );
    }

    /**
     * 合并视频段
     */
    private async mergeVideoSourcesCached(videoAssets: VideoAsset[], params: VideoProcessorInputs) {
        return await this.stepCache.executeStep(
            'merge-processed-videos',
            async () => {
                this.context.reportLog('Merging processed video sources...', 'stdout');

                if (params.outputDir) {
                    const outputPath = path.join(params.outputDir, 'video', `merged_video.${params.config.format}`);
                    const fileListPath = path.join(params.outputDir, 'video', `filelist.txt`);
                    return await this.processor.mergeVideoSources(videoAssets, params.config, outputPath, fileListPath);
                } else {
                    this.context.reportLog('output Dir is required', 'stderr')
                }
            },
            'Merge all processed video sources'
        );
    }

    private async saveProcessingProgress(completed: number, total: number, state: any, maxProgress: number = 100) {
        const progress = (completed / total) * maxProgress;

        await this.cacheManager.updateProgress(progress, {
            processedVideoAssets: [...state.processedVideoAssets],
            currentSourceIndex: completed
        });

        await this.context.reportProgress(progress);
    }

    private buildResult(state: any, mergedVideoAsset?: VideoAsset): VideoProcessorOutputs {
        this.context.reportLog('✓ Video processing completed successfully', 'stdout');

        return {
            mergedVideoAsset
        };
    }

    async destroy(): Promise<void> {
        await this.initPromise;
        if (this.fileManager) {
            await this.fileManager.destroy();
        }
    }
}

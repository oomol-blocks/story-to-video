import type { Context } from "@oomol/types/oocana";
import path from "path";

import { DoubaoVideoGenerator, VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/utils/VideoGenerator";
import { CacheManager, StepCache } from "~/cache/CacheManager";
import { createdManagers, VideoFileManager } from "~/file";
import { FileManager, FileStatus } from "~/file/FileManager";

export async function createCachedVideoGenerator(
    context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
    blockId: string
): Promise<{ generator: CachedVideoGenerator, cleanup: () => Promise<void> }> {
    const cacheManager = CacheManager.getInstance(context);
    const generator = new CachedVideoGenerator(context, cacheManager, blockId);

    await generator.initialize();

    return {
        generator,
        cleanup: async () => {
            await generator.destroy();
        }
    };
}

export class CachedVideoGenerator {
    private stepCache: StepCache;
    private generator: DoubaoVideoGenerator;
    private videoFileManager: VideoFileManager;
    private fileManager: FileManager;
    private cleanup?: () => Promise<void>;
    private isInitialized = false;

    constructor(
        private context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        private cacheManager: CacheManager,
        private BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new DoubaoVideoGenerator(context);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const managers = await createdManagers(this.context);
            this.fileManager = managers.fileManager;
            this.cleanup = managers.cleanup;
            this.videoFileManager = new VideoFileManager(this.fileManager);
            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize CachedVideoGenerator: ${error.message}`);
        }
    }

    private ensureInitialized(): void {
        if (!this.isInitialized || !this.fileManager || !this.videoFileManager) {
            throw new Error('CachedVideoGenerator not initialized. Call initialize() first.');
        }
    }

    /**
     * 生成视频
     */
    async generateVideo(params: VideoGeneratorInputs, segments: Segment[], resumeData?: any): Promise<VideoGeneratorOutputs> {
        this.ensureInitialized();
        this.context.reportLog('Generating video segments...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, segments, resumeData);

        try {
            // 生成剩余的视频段
            await this.generateRemainingVideoSegments(params, segments, state);

            // 合并视频
            const mergedVideoAsset = await this.mergeVideoSegmentsCached(state.videoAssets, params);

            // 返回结果
            return this.buildResult(state, mergedVideoAsset);
        } catch (error) {
            // 保存当前状态
            await this.cacheManager.updateBlockProgress(this.BLOCK_ID, (state.startIndex / segments.length) * 80, {
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
            const videoAsset = await this.generateSingleVideoSegmentCached(segment, params);

            // 更新状态
            state.videoAssets.push(videoAsset);

            // 保存进度
            await this.saveProgress(i + 1, segments.length, state, 80); // 80% for generation
        }
    }

    /**
     * 生成单个视频段
     */
    private async generateSingleVideoSegmentCached(
        segment: Segment,
        params: VideoGeneratorInputs
    ) {
        if (params.outputDir) {
            const tempPath = path.join(params.outputDir, 'video', `temp_video_${segment.id}.${params.config.format}`);
            const finalPath = path.join(params.outputDir, 'video', `video_${segment.id}.${params.config.format}`);

            return await this.stepCache.executeStep(
                `video-segment-${segment.id}`,
                async () => {
                    return {
                        videoAsset: await this.generator.generateSingleVideoSegmentToPath(
                            segment,
                            params.config,
                            tempPath,
                            finalPath
                        ),
                        tempFileId: null // 直接输出到目录时不需要管理临时文件
                    };
                },
                `Generate video segment ${segment.id}`
            );
        } else {
            // 如果没有 outputDir，使用文件管理器
            return await this.generateSingleVideoSegmentWithFileManagement(segment, params);
        }
    }

    private async generateSingleVideoSegmentWithFileManagement(
        segment: Segment,
        params: VideoGeneratorInputs
    ) {
        return await this.stepCache.executeStepWithFiles(
            `video-segment-${segment.id}`,
            async () => {
                // 创建临时视频文件管理记录
                const tempManagedFile = await this.videoFileManager.createTempVideoFile(
                    segment.id,
                    params.config.format
                );

                // 创建最终视频文件管理记录
                const finalManagedFile = await this.videoFileManager.createFinalVideoFile(
                    segment.id,
                    params.config.format
                );

                try {
                    // 更新状态
                    await this.fileManager.updateFileStatus(tempManagedFile.id, FileStatus.PROCESSING);
                    await this.fileManager.updateFileStatus(finalManagedFile.id, FileStatus.PROCESSING);

                    // 调用生成器生成视频段
                    const videoAsset = await this.generator.generateSingleVideoSegmentToPath(
                        segment,
                        params.config,
                        tempManagedFile.tempPath!,
                        finalManagedFile.tempPath!
                    );

                    // 更新文件状态
                    await this.fileManager.updateFileStatus(tempManagedFile.id, FileStatus.COMPLETED);
                    await this.fileManager.updateFileStatus(finalManagedFile.id, FileStatus.COMPLETED);

                    return {
                        result: {
                            videoAsset,
                            tempFileId: tempManagedFile.id
                        },
                        fileIds: [tempManagedFile.id, finalManagedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(tempManagedFile.id, FileStatus.FAILED);
                    await this.fileManager.updateFileStatus(finalManagedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            `Generate video segment ${segment.id}`
        );
    }

    /**
     * 合并视频段
     */
    private async mergeVideoSegmentsCached(videoAssets: any[], params: VideoGeneratorInputs) {
        return await this.stepCache.executeStep(
            'merge-videos',
            async () => {
                this.context.reportLog('Merging video segments...', 'stdout');

                if (params.outputDir) {
                    // 直接输出到指定目录
                    const outputPath = path.join(params.outputDir, 'video', `merged_video.${params.config.format}`);
                    return await this.generator.mergeVideoSegmentsToPath(videoAssets, params.config, outputPath);
                } else {
                    // 使用文件管理器创建合并文件
                    return await this.mergeVideoSegmentsWithFileManagement(videoAssets, params);
                }
            },
            'Merge all video segments'
        );
    }

    private async mergeVideoSegmentsWithFileManagement(videoAssets: any[], params: VideoGeneratorInputs) {
        return await this.stepCache.executeStepWithFiles(
            'merge-videos-with-files',
            async () => {
                // 创建合并文件的管理记录
                const mergedManagedFile = await this.videoFileManager.createFinalVideoFile(
                    'merged',
                    params.config.format
                );

                try {
                    await this.fileManager.updateFileStatus(mergedManagedFile.id, FileStatus.PROCESSING);

                    // 调用生成器合并视频
                    const mergedAsset = await this.generator.mergeVideoSegmentsToPath(
                        videoAssets,
                        params.config,
                        mergedManagedFile.tempPath!
                    );

                    await this.fileManager.updateFileStatus(mergedManagedFile.id, FileStatus.COMPLETED);

                    return {
                        result: mergedAsset,
                        fileIds: [mergedManagedFile.id]
                    };
                } catch (error) {
                    await this.fileManager.updateFileStatus(mergedManagedFile.id, FileStatus.FAILED);
                    throw error;
                }
            },
            'Merge videos with file management'
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any, maxProgress: number = 100) {
        const progress = (completed / total) * maxProgress;

        await this.cacheManager.updateBlockProgress(this.BLOCK_ID, progress, {
            videoAssets: [...state.videoAssets],
            currentSegmentIndex: completed
        });

        await this.context.reportProgress(progress);
    }

    private buildResult(state: any, mergedVideoAsset: any): VideoGeneratorOutputs {
        this.context.reportLog('✓ Video generation completed successfully', 'stdout');

        return {
            videoAssets: state.videoAssets,
            mergedVideoAsset
        };
    }

    async destroy(): Promise<void> {
        if (this.cleanup) {
            await this.cleanup();
            this.context.reportLog("CachedVideoGenerator destroyed", "stdout");
        }
    }
}

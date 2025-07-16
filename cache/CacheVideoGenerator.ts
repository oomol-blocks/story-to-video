import type { Context } from "@oomol/types/oocana";
import { DoubaoVideoGenerator, VideoGeneratorInputs, VideoGeneratorOutputs, Segment } from "~/utils/VideoGenerator";
import { WorkflowCacheManager, StepCache } from "~/utils/Cache";

export class CachedVideoGenerator {
    private stepCache: StepCache;
    private generator: DoubaoVideoGenerator;

    constructor(
        private context: Context<VideoGeneratorInputs, VideoGeneratorOutputs>,
        private cacheManager: WorkflowCacheManager,
        private BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new DoubaoVideoGenerator(context);
    }

    /**
     * 生成视频
     */
    async generateVideo(params: VideoGeneratorInputs, segments: Segment[], resumeData?: any): Promise<VideoGeneratorOutputs> {
        this.context.reportLog('Generating video segments...', "stdout");

        // 初始化状态
        const state = this.initializeState(params, segments, resumeData);

        try {
            // 生成剩余的视频段
            await this.generateRemainingVideoSegments(params, segments, state);

            // 合并视频
            const mergedVideoAsset = await this.mergeVideoSegmentsCached(state.videoAssets, params);

            // 清理临时文件
            await this.cleanupTemporaryFilesCached(params, state.tempVideoFiles, state.videoAssets);

            // 返回结果
            return this.buildResult(state, mergedVideoAsset);

        } catch (error) {
            // 保存当前状态
            await this.cacheManager.updateBlockProgress(this.BLOCK_ID, (state.startIndex / segments.length) * 80, {
                videoAssets: state.videoAssets,
                tempVideoFiles: state.tempVideoFiles,
                currentSegmentIndex: state.startIndex,
                error: error.message
            });

            // 尝试清理临时文件
            this.context.reportLog('Error occurred, attempting cleanup...', 'stderr');
            try {
                await this.generator.cleanupTemporaryFiles(
                    params.audioAssets,
                    params.imageAssets,
                    params.subtitleAssets,
                    state.tempVideoFiles,
                    []
                );
            } catch (cleanupError) {
                this.context.reportLog(`Cleanup failed: ${cleanupError.message}`, 'stderr');
            }

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
            const { videoAsset, tempFilePath } = await this.generateSingleVideoSegmentCached(segment, params);

            // 更新状态
            state.videoAssets.push(videoAsset);
            if (tempFilePath) {
                state.tempVideoFiles.push(tempFilePath);
            }

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
        return await this.stepCache.executeStep(
            `video-segment-${segment.id}`,
            async () => {
                this.context.reportLog(`Generating video segment for ${segment.id}`, "stdout");

                // 分步骤执行视频生成
                const tempFilePath = `${params.outputDir}/temp_video_${segment.id}.${params.config.format}`;
                const finalFilePath = `${params.outputDir}/video_${segment.id}.${params.config.format}`;

                // 步骤1: API调用生成视频
                const videoUrl = await this.stepCache.executeStep(
                    `api-call-${segment.id}`,
                    async () => {
                        this.context.reportLog(`Calling video API for segment ${segment.id}`, "stdout");
                        return await this.generator.callVideoAPI(segment);
                    },
                    `Call video API for segment ${segment.id}`
                );

                // 步骤2: 下载视频
                await this.stepCache.executeStep(
                    `download-${segment.id}`,
                    async () => {
                        this.context.reportLog(`Downloading video for segment ${segment.id}`, "stdout");
                        return await this.generator.downloadVideo(videoUrl, tempFilePath);
                    },
                    `Download video for segment ${segment.id}`
                );

                // 步骤3: 合成视频（添加音频和字幕）
                await this.stepCache.executeStep(
                    `composite-${segment.id}`,
                    async () => {
                        this.context.reportLog(`Compositing video for segment ${segment.id}`, "stdout");
                        return await this.generator.compositeVideo(segment, tempFilePath, finalFilePath, params.config);
                    },
                    `Composite video for segment ${segment.id}`
                );

                // 获取视频信息
                const videoInfo = await this.generator.getVideoInfo(finalFilePath);

                return {
                    videoAsset: {
                        id: segment.id,
                        filePath: finalFilePath,
                        duration: videoInfo.duration,
                        resolution: params.config.size,
                        fileSize: videoInfo.fileSize,
                        format: params.config.format,
                        createdAt: new Date()
                    },
                    tempFilePath: tempFilePath
                };
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
                return await this.generator.mergeVideoSegments(videoAssets, params.config, params.outputDir);
            },
            'Merge all video segments'
        );
    }

    /**
     * 清理临时文件
     */
    private async cleanupTemporaryFilesCached(params: VideoGeneratorInputs, tempVideoFiles: string[], videoAssets: any[]) {
        return await this.stepCache.executeStep(
            'cleanup',
            async () => {
                this.context.reportLog('Cleaning up temporary files...', 'stdout');
                await this.generator.cleanupTemporaryFiles(
                    params.audioAssets,
                    params.imageAssets,
                    params.subtitleAssets,
                    tempVideoFiles,
                    videoAssets
                );
            },
            'Clean up temporary files'
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any, maxProgress: number = 100) {
        const progress = (completed / total) * maxProgress;

        await this.cacheManager.updateBlockProgress(this.BLOCK_ID, progress, {
            videoAssets: [...state.videoAssets],
            tempVideoFiles: [...state.tempVideoFiles],
            currentSegmentIndex: completed
        });

        await this.context.reportProgress(progress);
    }

    /**
     * 构建最终结果
     */
    private buildResult(state: any, mergedVideoAsset: any): VideoGeneratorOutputs {
        this.context.reportLog('✓ Video generation completed successfully', 'stdout');

        return {
            videoAssets: state.videoAssets,
            mergedVideoAsset
        };
    }
}

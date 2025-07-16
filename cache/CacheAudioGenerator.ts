import type { Context } from "@oomol/types/oocana";
import { AudioGenerator, AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";
import { WorkflowCacheManager, StepCache } from "~/utils/Cache";

export class CachedAudioGenerator {
    private stepCache: StepCache;
    private generator: AudioGenerator;

    constructor(
        private context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>,
        private cacheManager: WorkflowCacheManager,
        private BLOCK_ID: string
    ) {
        this.stepCache = new StepCache(cacheManager, BLOCK_ID, context);
        this.generator = new AudioGenerator(context);
    }

    /**
     * 生成音频，判断是否可以恢复
     */
    async generateAudio(params: AudioGeneratorInputs, resumeData?: any): Promise<AudioGeneratorOutputs> {
        this.context.reportLog('Generating audio files...', "stdout");
        
        // 初始化状态
        const state = this.initializeState(params, resumeData);
        
        // 生成剩余的音频
        await this.generateRemainingAudio(params, state);
        
        // 返回结果
        return this.buildResult(state);
    }

    /**
     * 初始化生成状态——恢复或重新开始
     */
    private initializeState(params: AudioGeneratorInputs, resumeData?: any) {
        const audioAssets = resumeData?.audioAssets || [];
        const currentStartTime = resumeData?.currentStartTime || 0;
        const startIndex = resumeData?.completedCount || 0;

        if (audioAssets.length > 0) {
            this.context.reportLog(
                `Resumed with ${audioAssets.length} existing audio assets from index ${startIndex}`, 
                "stdout"
            );
        }

        return {
            audioAssets,
            currentStartTime,
            startIndex,
            totalTexts: params.texts.length
        };
    }

    /**
     * 生成剩余的音频文件
     */
    private async generateRemainingAudio(params: AudioGeneratorInputs, state: any) {
        for (let i = state.startIndex; i < params.texts.length; i++) {
            const text = params.texts[i];
            
            // 生成单个音频
            const audioAsset = await this.generateSingleAudioCached(text, params, state.currentStartTime);
            
            // 更新状态
            state.audioAssets.push(audioAsset);
            state.currentStartTime = audioAsset.timing.endTime;
            
            // 保存进度
            await this.saveProgress(i + 1, params.texts.length, state);
        }
    }

    /**
     * 生成单个音频文件，判断是否有缓存
     */
    private async generateSingleAudioCached(
        text: { id: string; content: string }, 
        params: AudioGeneratorInputs, 
        startTime: number
    ) {
        return await this.stepCache.executeStep(
            `${this.BLOCK_ID}-${text.id}`,
            () => this.generator.generateSingleAudio(text, params.config, params.outputDir, startTime),
            `Generate audio for text ${text.id}`
        );
    }

    /**
     * 保存当前进度
     */
    private async saveProgress(completed: number, total: number, state: any) {
        const progress = (completed / total) * 100;
        
        await this.cacheManager.updateBlockProgress(this.BLOCK_ID, progress, {
            completedCount: completed,
            audioAssets: [...state.audioAssets],
            currentStartTime: state.currentStartTime
        });

        await this.context.reportProgress(progress);
    }

    private buildResult(state: any): AudioGeneratorOutputs {
        const totalDuration = state.audioAssets.reduce(
            (sum: number, asset: any) => sum + asset.timing.duration, 
            0
        );
        
        this.context.reportLog(
            `Audio generation completed. Total duration: ${totalDuration.toFixed(2)}s`, 
            "stdout"
        );
        
        return { 
            audioAssets: state.audioAssets, 
            totalDuration 
        };
    }
}
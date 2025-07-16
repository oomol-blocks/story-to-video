import * as fs from "node:fs/promises";
import * as path from "path";
import { createHash } from "node:crypto";
import type { Context } from "@oomol/types/oocana";

export enum CacheStatus {
    NOT_STARTED = 'not_started',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface StepCacheInfo {
    stepId: string;
    status: CacheStatus;
    data?: any;
    timestamp: number;
}

export interface BlockCacheInfo {
    blockId: string;
    inputHash: string;
    status: CacheStatus;
    progress: number;
    startTime?: number;
    endTime?: number;
    outputs?: any;
    error?: string;
    steps: Record<string, StepCacheInfo>;
    resumeData?: any;
}

export interface WorkflowCacheState {
    blocks: Record<string, BlockCacheInfo>;
    lastUpdated: number;
}

export class WorkflowCacheManager {
    private cacheDir: string;
    private stateFile: string;
    private state: WorkflowCacheState;
    private isInitialized = false;
    private static instance: WorkflowCacheManager | null = null;

    constructor(private context: Context<any, any>) {
        this.cacheDir = path.join(context.pkgDir, 'workflow-cache');
        this.stateFile = path.join(this.cacheDir, 'workflow-state.json');
        this.state = {
            blocks: {},
            lastUpdated: Date.now()
        };
    }

    /**
     * 单例模式：整个应用只有一个缓存管理器实例
     */
    static getInstance(context: Context<any, any>): WorkflowCacheManager {
        if (!WorkflowCacheManager.instance) {
            WorkflowCacheManager.instance = new WorkflowCacheManager(context);
        }
        return WorkflowCacheManager.instance;
    }

    static clearInstance(): void {
        WorkflowCacheManager.instance = null;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.ensureDirectory(this.cacheDir);
        await this.loadState();
        this.isInitialized = true;

        this.context.reportLog(`Cache initialized: ${Object.keys(this.state.blocks).length} blocks found`, "stdout");
    }

    private calculateInputHash(inputs: any): string {
        const sortedInputs = this.deepSortObject(inputs);
        const inputString = JSON.stringify(sortedInputs);
        return createHash('sha256').update(inputString).digest('hex');
    }

    private deepSortObject(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepSortObject(item));
        }

        const sortedKeys = Object.keys(obj).sort();
        const sortedObj: any = {};
        for (const key of sortedKeys) {
            sortedObj[key] = this.deepSortObject(obj[key]);
        }
        return sortedObj;
    }

    async canSkipBlock(blockId: string, inputs: any): Promise<{
        canSkip: boolean;
        outputs?: any;
        shouldResume?: boolean;
        resumeData?: any;
        completedSteps?: string[];
        progress?: number
    }> {
        const inputHash = this.calculateInputHash(inputs);
        const blockCache = this.state.blocks[blockId];

        this.context.reportLog(`Checking cache for block: ${blockId}`, "stdout");

        // 没有缓存
        if (!blockCache) {
            this.context.reportLog(`No cache found for block: ${blockId}`, "stdout");
            return { canSkip: false };
        }

        // 输入不一致
        if (blockCache.inputHash !== inputHash) {
            this.context.reportLog(`Input changed for block: ${blockId}, invalidating cache`, "stdout");
            await this.invalidateBlock(blockId);
            return { canSkip: false };
        }

        // 当前状态以完成并且有输出
        if (blockCache.status === CacheStatus.COMPLETED && blockCache.outputs) {
            this.context.reportLog(`✓ Block ${blockId} found in cache, skipping...`, "stdout");
            return {
                canSkip: true,
                outputs: blockCache.outputs,
                progress: 100
            };
        }

        // 如果已经是正在进行中或失败，则获取已经存储的数据
        if (blockCache.status === CacheStatus.IN_PROGRESS || blockCache.status === CacheStatus.FAILED) {
            const completedSteps = Object.keys(blockCache.steps).filter(
                stepId => blockCache.steps[stepId].status === CacheStatus.COMPLETED
            );

            if (completedSteps.length > 0 || blockCache.progress > 0) {
                this.context.reportLog(
                    `Block ${blockId} can be resumed from ${blockCache.progress}% (${completedSteps.length} steps completed)`,
                    "stdout"
                );

                return {
                    canSkip: false,
                    shouldResume: true,
                    resumeData: blockCache.resumeData,
                    completedSteps,
                    progress: blockCache.progress
                };
            }
        }

        return { canSkip: false };
    }

    async startBlock(blockId: string, inputs: any, resumeData?: any): Promise<void> {
        const inputHash = this.calculateInputHash(inputs);

        if (this.state.blocks[blockId] && this.state.blocks[blockId].inputHash === inputHash) {
            this.state.blocks[blockId].status = CacheStatus.IN_PROGRESS;
            if (resumeData) {
                this.state.blocks[blockId].resumeData = resumeData;
            }
        } else {
            this.state.blocks[blockId] = {
                blockId,
                inputHash,
                status: CacheStatus.IN_PROGRESS,
                progress: 0,
                startTime: Date.now(),
                steps: {},
                resumeData
            };
        }

        await this.saveState();
        this.context.reportLog(`Started block ${blockId}`, "stdout");
    }

    async isStepCompleted(blockId: string, stepId: string): Promise<{ completed: boolean; data?: any }> {
        const blockCache = this.state.blocks[blockId];
        if (!blockCache || !blockCache.steps[stepId]) {
            return { completed: false };
        }

        const stepCache = blockCache.steps[stepId];
        if (stepCache.status === CacheStatus.COMPLETED) {
            this.context.reportLog(`✓ Step ${stepId} found in cache, skipping...`, "stdout");
            return { completed: true, data: stepCache.data };
        }

        return { completed: false };
    }

    async completeStep(blockId: string, stepId: string, data?: any): Promise<void> {
        if (!this.state.blocks[blockId]) {
            return;
        }

        this.state.blocks[blockId].steps[stepId] = {
            stepId,
            status: CacheStatus.COMPLETED,
            data,
            timestamp: Date.now()
        };

        await this.saveState();
        this.context.reportLog(`✓ Step ${stepId} completed`, "stdout");
    }

    async failStep(blockId: string, stepId: string, error: string): Promise<void> {
        if (!this.state.blocks[blockId]) {
            return;
        }

        this.state.blocks[blockId].steps[stepId] = {
            stepId,
            status: CacheStatus.FAILED,
            data: { error },
            timestamp: Date.now()
        };

        await this.saveState();
        this.context.reportLog(`✗ Step ${stepId} failed: ${error}`, "stderr");
    }

    async updateBlockProgress(blockId: string, progress: number, resumeData?: any): Promise<void> {
        if (this.state.blocks[blockId]) {
            this.state.blocks[blockId].progress = Math.min(100, Math.max(0, progress));
            this.state.blocks[blockId].status = CacheStatus.IN_PROGRESS;

            if (resumeData) {
                this.state.blocks[blockId].resumeData = resumeData;
            }

            await this.saveState();
        }
    }

    async completeBlock(blockId: string, outputs: any): Promise<void> {
        if (this.state.blocks[blockId]) {
            this.state.blocks[blockId].status = CacheStatus.COMPLETED;
            this.state.blocks[blockId].progress = 100;
            this.state.blocks[blockId].endTime = Date.now();
            this.state.blocks[blockId].outputs = outputs;
            this.state.blocks[blockId].error = undefined;
            this.state.blocks[blockId].resumeData = undefined;

            await this.saveState();
            this.context.reportLog(`✓ Block ${blockId} completed successfully`, "stdout");
        }
    }

    async failBlock(blockId: string, error: string): Promise<void> {
        if (this.state.blocks[blockId]) {
            this.state.blocks[blockId].status = CacheStatus.FAILED;
            this.state.blocks[blockId].error = error;
            this.state.blocks[blockId].endTime = Date.now();

            await this.saveState();
            this.context.reportLog(`✗ Block ${blockId} failed: ${error}`, "stderr");
        }
    }

    private async invalidateBlock(blockId: string): Promise<void> {
        if (this.state.blocks[blockId]) {
            delete this.state.blocks[blockId];
            await this.saveState();
            this.context.reportLog(`Invalidated cache for block ${blockId}`, "stdout");
        }
    }

    /**
     * 获取整个工作流的状态概览
     */
    getWorkflowStatus(): {
        totalBlocks: number;
        completedBlocks: number;
        failedBlocks: number;
        inProgressBlocks: number;
        overallProgress: number;
    } {
        const blocks = Object.values(this.state.blocks);
        const totalBlocks = blocks.length;
        const completedBlocks = blocks.filter(b => b.status === CacheStatus.COMPLETED).length;
        const failedBlocks = blocks.filter(b => b.status === CacheStatus.FAILED).length;
        const inProgressBlocks = blocks.filter(b => b.status === CacheStatus.IN_PROGRESS).length;

        const overallProgress = totalBlocks > 0
            ? Math.round(blocks.reduce((sum, block) => sum + block.progress, 0) / totalBlocks)
            : 0;

        return {
            totalBlocks,
            completedBlocks,
            failedBlocks,
            inProgressBlocks,
            overallProgress
        };
    }

    async clearCache(): Promise<void> {
        try {
            await fs.rm(this.cacheDir, { recursive: true, force: true });
            this.state = {
                blocks: {},
                lastUpdated: Date.now()
            };
            this.context.reportLog("Cache cleared successfully", "stdout");
        } catch (error) {
            this.context.reportLog(`Failed to clear cache: ${error}`, "stderr");
        }
    }

    private async loadState(): Promise<void> {
        try {
            const stateContent = await fs.readFile(this.stateFile, 'utf-8');
            const loadedState = JSON.parse(stateContent);

            this.state = loadedState;
            this.context.reportLog(`Loaded cache state with ${Object.keys(this.state.blocks).length} blocks`, "stdout");
        } catch {
            this.context.reportLog("No existing cache found, starting fresh", "stdout");
        }
    }

    private async saveState(): Promise<void> {
        try {
            this.state.lastUpdated = Date.now();
            const stateContent = JSON.stringify(this.state, null, 2);
            await fs.writeFile(this.stateFile, stateContent, 'utf-8');
        } catch (error) {
            this.context.reportLog(`Failed to save cache state: ${error}`, "stderr");
        }
    }

    private async ensureDirectory(dir: string): Promise<void> {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create directory ${dir}: ${error}`);
        }
    }
}

export function withCache<TInputs, TOutputs>(
    blockId: string,
    blockFunction: (params: TInputs, context: Context<TInputs, TOutputs>, cacheManager: WorkflowCacheManager, resumeData?: any) => Promise<TOutputs>
) {
    return async (params: TInputs, context: Context<TInputs, TOutputs>): Promise<TOutputs> => {
        // 使用单例模式获取缓存管理器
        const cacheManager = WorkflowCacheManager.getInstance(context);
        await cacheManager.initialize();

        try {
            // 检查是否可以跳过整个block
            const cacheResult = await cacheManager.canSkipBlock(blockId, params);

            // 如果可以跳过，则返回缓存结果
            if (cacheResult.canSkip && cacheResult.outputs) {
                return cacheResult.outputs;
            }

            await cacheManager.startBlock(blockId, params, cacheResult.resumeData);

            const result = await blockFunction(params, context, cacheManager, cacheResult.resumeData);

            await cacheManager.completeBlock(blockId, result);
            return result;
        } catch (error) {
            await cacheManager.failBlock(blockId, error.message || String(error));
            throw error;
        }
    };
}

export class StepCache {
    constructor(
        private cacheManager: WorkflowCacheManager,
        private blockId: string,
        private context: Context<any, any>
    ) { }

    async executeStep<T>(
        stepId: string,
        stepFunction: () => Promise<T>,
        description?: string
    ): Promise<T> {
        const stepResult = await this.cacheManager.isStepCompleted(this.blockId, stepId);
        if (stepResult.completed) {
            return stepResult.data;
        }

        try {
            if (description) {
                this.context.reportLog(`Executing step: ${description}`, "stdout");
            }

            const result = await stepFunction();
            await this.cacheManager.completeStep(this.blockId, stepId, result);
            return result;

        } catch (error) {
            await this.cacheManager.failStep(this.blockId, stepId, error.message || String(error));
            throw error;
        }
    }
}

import * as fs from "node:fs/promises";
import * as path from "path";
import { createHash } from "node:crypto";
import type { Context } from "@oomol/types/oocana";

import { EventEmitter } from "./event";

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
    fileIds?: string[]; // 如果有文件的话，根据文件 id
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
    fileIds?: string[];
}

export interface CacheState {
    block: BlockCacheInfo;
    lastUpdated: number;
}

export class CacheManager extends EventEmitter {
    private cacheDir: string;
    private stateFile: string;
    private state: CacheState;
    private isInitialized = false;

    constructor(private context: Context<any, any>, private BLOCK_ID: string) {
        super();

        this.cacheDir = path.join(context.pkgDir, 'workflow-cache');
        this.stateFile = path.join(this.cacheDir, `workflow-state-${BLOCK_ID}.json`);

        this.state = this.createDefaultState();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.ensureDirectory(this.cacheDir);
        await this.loadState();
        this.isInitialized = true;

        const hasCache = this.state !== null;
        this.context.reportLog(`Cache initialized for block ${this.BLOCK_ID}: ${hasCache ? 'found existing' : 'starting fresh'}`, "stdout");
    }

    async canSkipBlock(inputs: any): Promise<{
        canSkip: boolean;
        outputs?: any;
        shouldResume?: boolean;
        resumeData?: any;
        completedSteps?: string[];
        progress?: number
    }> {
        const inputHash = this.calculateInputHash(inputs);
        const blockCache = this.state.block;

        if (blockCache.status === CacheStatus.NOT_STARTED || !blockCache.inputHash) {
            this.context.reportLog(`No cache found for block: ${this.BLOCK_ID}`, "stdout");
            return { canSkip: false };
        }


        // 输入不一致
        if (blockCache.inputHash !== inputHash) {
            this.context.reportLog(`Input changed for block: ${this.BLOCK_ID}, invalidating cache`, "stdout");
            await this.invalidateBlock();
            return { canSkip: false };
        }

        // 当前状态以完成并且有输出
        if (blockCache.status === CacheStatus.COMPLETED && blockCache.outputs) {
            this.context.reportLog(`✓ Block ${this.BLOCK_ID} found in cache, skipping...`, "stdout");
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
                    `Block ${this.BLOCK_ID} can be resumed from ${blockCache.progress}% (${completedSteps.length} steps completed)`,
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

    async startBlock(inputs: any, resumeData?: any): Promise<void> {
        const inputHash = this.calculateInputHash(inputs);

        if (this.state && this.state.block.inputHash === inputHash && this.state.block.status !== CacheStatus.NOT_STARTED) {
            this.state.block.status = CacheStatus.IN_PROGRESS;
            if (resumeData) {
                this.state.block.resumeData = resumeData;
            }
        } else {
            this.state.block = {
                blockId: this.BLOCK_ID,
                inputHash,
                status: CacheStatus.IN_PROGRESS,
                progress: 0,
                startTime: Date.now(),
                steps: {},
                resumeData
            };
        }

        await this.saveState();
        this.context.reportLog(`Started block ${this.BLOCK_ID}`, "stdout");
    }

    async completeStepWithFiles(stepId: string, data?: any, fileIds?: string[]): Promise<void> {
        this.state.block.steps[stepId] = {
            stepId,
            status: CacheStatus.COMPLETED,
            data,
            timestamp: Date.now(),
            fileIds: fileIds || []
        };

        // 将文件 ID 添加到块级别
        if (fileIds && fileIds.length > 0) {
            if (!this.state.block.fileIds) {
                this.state.block.fileIds = [];
            }
            this.state.block.fileIds.push(...fileIds);
        }

        await this.saveState();
        this.context.reportLog(`✓ Step ${stepId} completed with ${fileIds?.length || 0} files`, "stdout");
    }

    async isStepCompleted(stepId: string): Promise<{ completed: boolean; data?: any }> {
        if (!this.state) {
            this.context.reportLog(`this.state is null`, "stderr");
            return { completed: false };
        }

        const stepCache = this.state.block.steps[stepId];
        if (stepCache?.status === CacheStatus.COMPLETED) {
            this.context.reportLog(`✓ Step ${stepId} found in cache, skipping...`, "stdout");
            return { completed: true, data: stepCache.data };
        }

        return { completed: false };
    }

    async completeStep(stepId: string, data?: any): Promise<void> {
        await this.completeStepWithFiles(stepId, data);
    }

    async failStep(stepId: string, error: string): Promise<void> {
        this.state.block.steps[stepId] = {
            stepId,
            status: CacheStatus.FAILED,
            data: { error },
            timestamp: Date.now()
        };

        await this.saveState();
        this.context.reportLog(`✗ Step ${stepId} failed: ${error}`, "stderr");
    }

    async updateProgress(progress: number, resumeData?: any): Promise<void> {
        this.state.block.progress = Math.min(100, Math.max(0, progress));
        this.state.block.status = CacheStatus.IN_PROGRESS;

        if (resumeData) {
            this.state.block.resumeData = resumeData;
        }

        await this.saveState();
    }

    async completeBlock(outputs: any): Promise<void> {
        this.state.block.status = CacheStatus.COMPLETED;
        this.state.block.progress = 100;
        this.state.block.endTime = Date.now();
        this.state.block.outputs = outputs;
        this.state.block.error = undefined;
        this.state.block.resumeData = undefined;

        // 自动收集所有步骤中的文件ID
        const allFileIds = new Set<string>();

        // 添加现有的块级别文件ID
        if (this.state.block.fileIds) {
            this.state.block.fileIds.forEach(id => allFileIds.add(id));
        }

        // 添加所有步骤中的文件ID
        Object.values(this.state.block.steps).forEach(step => {
            if (step.fileIds) {
                step.fileIds.forEach(id => allFileIds.add(id));
            }
        });

        this.state.block.fileIds = Array.from(allFileIds);

        await this.saveState();
        this.context.reportLog(`✓ Block ${this.BLOCK_ID} completed with ${allFileIds.size} total files`, "stdout");
    }

    async failBlock(error: string): Promise<void> {
        this.state.block.status = CacheStatus.FAILED;
        this.state.block.error = error;
        this.state.block.endTime = Date.now();

        await this.saveState();
        this.context.reportLog(`✗ Block ${this.BLOCK_ID} failed: ${error}`, "stderr");

    }

    private async invalidateBlock(): Promise<void> {
        // 收集所有相关文件ID
        const allFileIds = new Set<string>();

        // 块级别的文件
        if (this.state.block.fileIds) {
            this.state.block.fileIds.forEach(id => allFileIds.add(id));
        }

        // 步骤级别的文件
        Object.values(this.state.block.steps).forEach(step => {
            if (step.fileIds) {
                step.fileIds.forEach(id => allFileIds.add(id));
            }
        });

        // 清理关联文件
        if (allFileIds.size > 0) {
            this.context.reportLog(`Cleaning up ${allFileIds.size} files for block ${this.BLOCK_ID}`, "stdout");
            this.emit('cache:block:invalidated', { blockId: this.BLOCK_ID, fileIds: Array.from(allFileIds) });
        }

        // 清理状态文件
        try {
            await fs.unlink(this.stateFile);
            this.context.reportLog(`Invalidated cache file for block ${this.BLOCK_ID}`, "stdout");
        } catch (error) {
            // 文件可能不存在，忽略错误
            this.context.reportLog(`Cache file already removed for block ${this.BLOCK_ID}`, "stdout");
        }

        // 清除当前状态
        this.state = this.createDefaultState();
    }

    private async loadState(): Promise<void> {
        try {
            const stateContent = await fs.readFile(this.stateFile, 'utf-8');
            const loadedState = JSON.parse(stateContent);

            this.state = loadedState;
            this.context.reportLog(`Loaded cache state with ${Object.keys(this.state.block).length} block`, "stdout");
        } catch {
            this.state = this.createDefaultState();
            this.context.reportLog("No existing cache found, starting fresh", "stdout");
        }
    }

    private async saveState(): Promise<void> {
        try {
            this.state.lastUpdated = Date.now();

            const stateContent = JSON.stringify(this.state, null, 2);

            // 原子写入
            const tempFile = `${this.stateFile}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 5)}`;
            await fs.writeFile(tempFile, stateContent, 'utf-8');
            await fs.rename(tempFile, this.stateFile);

            this.context.reportLog(`✓ Cache state saved for block ${this.BLOCK_ID} (${stateContent.length} bytes)`, "stdout");
        } catch (error) {
            this.context.reportLog(`Failed to save cache state for block ${this.BLOCK_ID}: ${error}`, "stderr");
        }
    }

    async clearCache(): Promise<void> {
        const allFileIds = new Set<string>();

        if (this.state.block.fileIds) {
            this.state.block.fileIds.forEach(id => allFileIds.add(id));
        }

        Object.values(this.state.block.steps).forEach(step => {
            if (step.fileIds) {
                step.fileIds.forEach(id => allFileIds.add(id));
            }
        });

        if (allFileIds.size > 0) {
            this.context.reportLog(`Publishing cache clear event: ${allFileIds.size} files`, "stdout");
            this.emit('cache:cleared', { fileIds: Array.from(allFileIds) });
        }

        // 清除状态文件
        try {
            await fs.unlink(this.stateFile);
            this.context.reportLog(`Cache cleared for block ${this.BLOCK_ID}`, "stdout");
        } catch (error) {
            this.context.reportLog(`Cache file already removed for block ${this.BLOCK_ID}`, "stdout");
        }

        // 重制 state 状态
        this.state = this.createDefaultState();
    }

    private createDefaultState(): CacheState {
        return {
            block: {
                blockId: this.BLOCK_ID,
                inputHash: '',
                status: CacheStatus.NOT_STARTED,
                progress: 0,
                steps: {},
            },
            lastUpdated: Date.now()
        };
    }

    private async ensureDirectory(dir: string): Promise<void> {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create directory ${dir}: ${error}`);
        }
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
}

export function withCache<TInputs, TOutputs>(
    blockId: string,
    blockFunction: (params: TInputs, context: Context<TInputs, TOutputs>, cacheManager: CacheManager, resumeData?: any) => Promise<TOutputs>
) {
    return async (params: TInputs, context: Context<TInputs, TOutputs>): Promise<TOutputs> => {
        const cacheManager = new CacheManager(context, blockId);
        await cacheManager.initialize();

        try {
            // 检查是否可以跳过整个block
            const cacheResult = await cacheManager.canSkipBlock(params);

            // 如果可以跳过，则返回缓存结果
            if (cacheResult.canSkip && cacheResult.outputs) {
                return cacheResult.outputs;
            }

            await cacheManager.startBlock(params, cacheResult.resumeData);

            const result = await blockFunction(params, context, cacheManager, cacheResult.resumeData);

            await cacheManager.completeBlock(result);
            return result;
        } catch (error) {
            await cacheManager.failBlock(error.message || String(error));
            throw error;
        }
    };
}

// Manager 语法糖
export class StepCache {
    constructor(
        private cacheManager: CacheManager,
        private blockId: string,
        private context: Context<any, any>
    ) { }

    async executeStep<T>(
        stepId: string,
        stepFunction: () => Promise<T>,
        description?: string
    ): Promise<T> {
        const stepResult = await this.cacheManager.isStepCompleted(stepId);
        if (stepResult.completed) {
            return stepResult.data;
        }

        try {
            if (description) {
                this.context.reportLog(`Executing step: ${description}`, "stdout");
            }

            const result = await stepFunction();
            await this.cacheManager.completeStep(stepId, result);
            return result;
        } catch (error) {
            await this.cacheManager.failStep(stepId, error.message || String(error));
            throw error;
        }
    }

    async executeStepWithFiles<T>(
        stepId: string,
        stepFunction: () => Promise<{ result: T, fileIds: string[] }>,
        description?: string
    ): Promise<T> {
        const stepResult = await this.cacheManager.isStepCompleted(stepId);
        if (stepResult.completed) {
            return stepResult.data.result;
        }

        try {
            if (description) {
                this.context.reportLog(`Executing step: ${description}`, "stdout");
            }

            const { result, fileIds } = await stepFunction();

            await this.cacheManager.completeStepWithFiles(
                stepId,
                { result, fileIds },
                fileIds
            );

            return result;
        } catch (error) {
            await this.cacheManager.failStep(stepId, error.message || String(error));
            throw error;
        }
    }
}

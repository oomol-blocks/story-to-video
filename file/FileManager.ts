import * as fs from "node:fs/promises";
import * as path from "path";
import type { Context } from "@oomol/types/oocana";

import { CacheManager } from "~/cache/CacheManager";
import { EventListener } from "~/cache/event";

export enum FileType {
    AUDIO = 'audio',
    IMAGE = 'image',
    VIDEO = 'video',
    SUBTITLE = 'subtitle',
    TEMP = 'temp'
}

export enum FileStatus {
    CREATING = 'creating',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CLEANING = 'cleaning'
}

export interface ManagedFile {
    id: string;
    type: FileType;
    status: FileStatus;
    tempPath?: string;
    finalPath?: string;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, any>;
}

export interface FileStatistics {
    totalFiles: number;
    byType: Record<FileType, number>;
    byStatus: Record<FileStatus, number>;
    tempFiles: number;
    completedFiles: number;
}

export interface FileManagerState {
    files: Record<string, ManagedFile>;
    lastUpdated: number;
}

export interface IFileManager {
    // Core file operations
    createTempFile(type: FileType, filename: string, metadata?: Record<string, any>): Promise<ManagedFile>;
    moveToFinal(fileId: string, finalPath: string): Promise<void>;
    updateFileStatus(fileId: string, status: FileStatus): Promise<void>;
    getFile(fileId: string): ManagedFile | null;

    // Path management
    getTempPath(type: FileType, filename: string): string;
    getFinalPath(outputDir: string, filename: string): string;
    ensureDirectory(dir: string): Promise<void>;

    cleanup(fileIds?: string[]): Promise<{ cleaned: string[], failed: string[] }>;

    // Statistics
    getFilesStatistics(): FileStatistics;
}

export class FileManager implements IFileManager {
    private files: Map<string, ManagedFile> = new Map();
    private tempDir: string;
    private stateFile: string;
    private state: FileManagerState;
    private cacheManager?: CacheManager;
    private eventListeners: { event: string, listener: EventListener }[] = [];
    private isInitialized = false;

    constructor(private context: Context<any, any>, cacheManager?: CacheManager, baseDir?: string) {
        this.tempDir = path.join(context.pkgDataDir, baseDir || 'temp');
        this.stateFile = path.join(this.tempDir, 'file-state.json');
        this.state = {
            files: {},
            lastUpdated: Date.now()
        };

        if (cacheManager) {
            this.cacheManager = cacheManager;
            this.setupCacheEventListeners(cacheManager);
        }
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.ensureDirectory(this.tempDir);
        await this.loadState();
        await this.initializeDirectories();
        this.isInitialized = true;

        this.context.reportLog(`FileManager initialized: ${this.files.size} files found`, "stdout");
    }

    private async loadState(): Promise<void> {
        try {
            const stateContent = await fs.readFile(this.stateFile, 'utf-8');
            const loadedState = JSON.parse(stateContent);

            this.state = loadedState;

            // Rebuild Map
            this.files.clear();
            for (const [id, file] of Object.entries(this.state.files)) {
                this.files.set(id, file);
            }

            this.context.reportLog(`Loaded file manager state with ${this.files.size} files`, "stdout");
        } catch {
            this.context.reportLog("No existing file manager state found, starting fresh", "stdout");
        }
    }

    private async saveState(): Promise<void> {
        try {
            this.state.files = Object.fromEntries(this.files.entries());
            this.state.lastUpdated = Date.now();

            const stateContent = JSON.stringify(this.state, null, 2);
            await fs.writeFile(this.stateFile, stateContent, 'utf-8');
        } catch (error) {
            this.context.reportLog(`Failed to save file manager state: ${error}`, "stderr");
        }
    }

    private setupCacheEventListeners(cacheManager: CacheManager): void {
        // Listen to block invalidation events
        const blockInvalidatedListener = async ({ blockId, fileIds }: { blockId: string, fileIds: string[] }) => {
            this.context.reportLog(`Handling file cleanup for invalidated block ${blockId}: ${fileIds.length} files`, "stdout");
            await this.cleanup(fileIds);
        };

        // Listen to cache clearing events
        const cacheClaredListener = async ({ fileIds }: { fileIds: string[] }) => {
            this.context.reportLog(`Handling file cleanup for cache clear: ${fileIds.length} files`, "stdout");
            await this.cleanup(fileIds);
        };

        // Register listeners
        cacheManager.on('cache:block:invalidated', blockInvalidatedListener);
        cacheManager.on('cache:cleared', cacheClaredListener);

        // Save listener references for later removal
        this.eventListeners.push(
            { event: 'cache:block:invalidated', listener: blockInvalidatedListener },
            { event: 'cache:cleared', listener: cacheClaredListener }
        );
    }

    private removeEventListeners(): void {
        if (this.cacheManager) {
            this.eventListeners.forEach(({ event, listener }) => {
                this.cacheManager!.off(event, listener);
            });
            this.eventListeners = [];
            this.context.reportLog("Removed file manager event listeners", "stdout");
        }
    }

    private async initializeDirectories(): Promise<void> {
        for (const type of Object.values(FileType)) {
            await this.ensureDirectory(path.join(this.tempDir, type));
        }
    }

    /**
     * Create temporary file record
     */
    async createTempFile(type: FileType, filename: string, metadata?: Record<string, any>): Promise<ManagedFile> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const fileId = this.generateFileId(type, filename);
        const tempPath = this.getTempPath(type, filename);

        await this.ensureDirectory(path.dirname(tempPath));

        const managedFile: ManagedFile = {
            id: fileId,
            type,
            status: FileStatus.CREATING,
            tempPath,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: metadata || {}
        };

        this.files.set(fileId, managedFile);
        await this.saveState();

        this.context.reportLog(`Created temp file record: ${fileId}`, "stdout");
        return managedFile;
    }

    /**
     * Move file to final location
     */
    async moveToFinal(fileId: string, finalPath: string): Promise<void> {
        const file = this.files.get(fileId);
        if (!file || !file.tempPath) {
            throw new Error(`File not found or no temp path: ${fileId}`);
        }

        await this.ensureDirectory(path.dirname(finalPath));

        try {
            // If temp file exists, move it; otherwise assume file is already in correct location
            try {
                await fs.access(file.tempPath);
                await fs.rename(file.tempPath, finalPath);
            } catch {
                // Temp file doesn't exist, check if target file exists
                await fs.access(finalPath);
            }

            file.finalPath = finalPath;
            file.tempPath = undefined;
            file.status = FileStatus.COMPLETED;
            file.updatedAt = Date.now();

            await this.saveState();
            this.context.reportLog(`Moved file ${fileId} to final location: ${finalPath}`, "stdout");
        } catch (error) {
            file.status = FileStatus.FAILED;
            file.updatedAt = Date.now();
            await this.saveState();
            throw new Error(`Failed to move file ${fileId}: ${error}`);
        }
    }

    /**
     * Update file status
     */
    async updateFileStatus(fileId: string, status: FileStatus): Promise<void> {
        const file = this.files.get(fileId);
        if (!file) {
            this.context.reportLog(`Warning: File not found for status update: ${fileId}`, "stderr");
            return;
        }

        file.status = status;
        file.updatedAt = Date.now();
        await this.saveState();
    }

    /**
     * Get file information
     */
    getFile(fileId: string): ManagedFile | null {
        return this.files.get(fileId) || null;
    }

    /**
     * Get temporary path
     */
    getTempPath(type: FileType, filename: string): string {
        return path.join(this.tempDir, type, filename);
    }

    /**
     * Get final path
     */
    getFinalPath(outputDir: string, filename: string): string {
        return path.join(outputDir, filename);
    }

    /**
     * Ensure directory exists
     */
    async ensureDirectory(dir: string): Promise<void> {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create directory ${dir}: ${error}`);
        }
    }

    /**
     * Clean up files
     */
    async cleanup(fileIds?: string[]): Promise<{ cleaned: string[], failed: string[] }> {
        const targetIds = fileIds || Array.from(this.files.keys());
        const cleaned: string[] = [];
        const failed: string[] = [];

        for (const fileId of targetIds) {
            const file = this.files.get(fileId);
            if (!file) {
                // File doesn't exist, may have been cleaned up or is a leftover ID after restart
                this.context.reportLog(`Warning: File not found for cleanup: ${fileId}`, "stderr");
                failed.push(fileId);
                continue;
            }

            try {
                await this.updateFileStatus(fileId, FileStatus.CLEANING);

                // Clean up temporary files
                if (file.tempPath) {
                    try {
                        await fs.unlink(file.tempPath);
                        this.context.reportLog(`✓ Deleted temp file: ${path.basename(file.tempPath)}`, "stdout");
                    } catch {
                        // Temp file may already be deleted
                        this.context.reportLog(`Temp file already deleted: ${path.basename(file.tempPath || '')}`, "stdout");
                    }
                }

                // Clean up final files
                if (file.finalPath) {
                    try {
                        await fs.unlink(file.finalPath);
                        this.context.reportLog(`✓ Deleted final file: ${path.basename(file.finalPath)}`, "stdout");
                    } catch {
                        // Final file may not exist
                        this.context.reportLog(`Final file already deleted: ${path.basename(file.finalPath || '')}`, "stdout");
                    }
                }

                this.files.delete(fileId);
                cleaned.push(fileId);
            } catch (error) {
                failed.push(fileId);
                await this.updateFileStatus(fileId, FileStatus.FAILED);
                this.context.reportLog(`Failed to cleanup file ${fileId}: ${error}`, "stderr");
            }
        }

        await this.saveState();

        this.context.reportLog(
            `Cleanup completed: ${cleaned.length} cleaned, ${failed.length} failed`,
            "stdout"
        );

        return { cleaned, failed };
    }

    /**
     * Get file statistics
     */
    getFilesStatistics(): FileStatistics {
        const allFiles = Array.from(this.files.values());

        const byType = {} as Record<FileType, number>;
        const byStatus = {} as Record<FileStatus, number>;

        // Initialize counters
        Object.values(FileType).forEach(type => byType[type] = 0);
        Object.values(FileStatus).forEach(status => byStatus[status] = 0);

        // Count statistics
        allFiles.forEach(file => {
            byType[file.type]++;
            byStatus[file.status]++;
        });

        return {
            totalFiles: allFiles.length,
            byType,
            byStatus,
            tempFiles: allFiles.filter(f => f.tempPath).length,
            completedFiles: allFiles.filter(f => f.status === FileStatus.COMPLETED).length
        };
    }

    async clearAllFiles(): Promise<void> {
        try {
            // Clean up all files
            await this.cleanup();

            // Clean up temp directory
            const tempSubDir = path.join(this.tempDir, 'temp');
            await fs.rm(tempSubDir, { recursive: true, force: true });

            // Reset state
            this.files.clear();
            this.state = {
                files: {},
                lastUpdated: Date.now()
            };

            await this.saveState();
            await this.initializeDirectories();

            this.context.reportLog("All files cleared successfully", "stdout");
        } catch (error) {
            this.context.reportLog(`Failed to clear all files: ${error}`, "stderr");
        }
    }

    /**
     * Generate unique file ID
     */
    private generateFileId(type: FileType, filename: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${type}_${path.parse(filename).name}_${timestamp}_${random}`;
    }

    async destroy(): Promise<void> {
        // Remove event listeners
        this.removeEventListeners();

        await this.saveState();
        this.context.reportLog("File manager destroyed", "stdout");
    }
}

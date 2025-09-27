import { FileType, IFileManager, ManagedFile } from "./FileManager";

// Audio/Image/Subtitle/Video file management
export class AudioFileManager {
    constructor(private fileManager: IFileManager) { }

    async createAudioFile(textId: string, format: string, content: string): Promise<ManagedFile> {
        return await this.fileManager.createTempFile(
            FileType.AUDIO,
            `audio_${textId}.${format}`,
            { textId, content }
        );
    }

    // If user has already provided outputDir, copy files to the target directory
    async finalizeAudioFile(fileId: string, outputDir: string, textId: string, format: string): Promise<void> {
        const finalPath = this.fileManager.getFinalPath(outputDir, `audio_${textId}.${format}`);
        await this.fileManager.moveToFinal(fileId, finalPath);
    }
}

export class ImageFileManager {
    constructor(private fileManager: IFileManager) { }

    async createImageFile(promptId: string, format: string, content: string): Promise<ManagedFile> {
        return await this.fileManager.createTempFile(
            FileType.IMAGE,
            `image_${promptId}.${format}`,
            { promptId, content }
        );
    }

    async finalizeImageFile(fileId: string, outputDir: string, promptId: string, format: string): Promise<void> {
        const finalPath = this.fileManager.getFinalPath(outputDir, `image_${promptId}.${format}`);
        await this.fileManager.moveToFinal(fileId, finalPath);
    }
}

export class SubtitleFileManager {
    constructor(private fileManager: IFileManager) { }

    async createSubtitleFile(textId: string, format: string, content: string): Promise<ManagedFile> {
        return await this.fileManager.createTempFile(
            FileType.SUBTITLE,
            `subtitle_${textId}.${format}`,
            { textId, content }
        );
    }

    async finalizeSubtitleFile(fileId: string, outputDir: string, textId: string, format: string): Promise<void> {
        const finalPath = this.fileManager.getFinalPath(outputDir, `subtitle_${textId}.${format}`);
        await this.fileManager.moveToFinal(fileId, finalPath);
    }
}

export class VideoFileManager {
    constructor(private fileManager: IFileManager) { }

    async createTempVideoFile(segmentId: string, format: string): Promise<ManagedFile> {
        return await this.fileManager.createTempFile(
            FileType.VIDEO,
            `temp_video_${segmentId}.${format}`,
            { segmentId, stage: 'temp' }
        );
    }

    async createFinalVideoFile(segmentId: string, format: string): Promise<ManagedFile> {
        return await this.fileManager.createTempFile(
            FileType.VIDEO,
            `video_${segmentId}.${format}`,
            { segmentId, stage: 'final' }
        );
    }

    async finalizeFinalVideoFile(fileId: string, outputDir: string, segmentId: string, format: string): Promise<void> {
        const finalPath = this.fileManager.getFinalPath(outputDir, `video_${segmentId}.${format}`);
        await this.fileManager.moveToFinal(fileId, finalPath);
    }
}

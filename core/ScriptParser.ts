import { Context } from "@oomol/types/oocana";

export interface ScriptScene {
    id: string;
    description: string;
    narration: string;
    visualPrompt: string;
    estimatedDuration: number;
}

export interface ScriptParserInputs {
    content: string;
}

export interface ScriptParserOutputs {
    scenes: ScriptScene[];
    metadata: {
        historicalPeriod: string; // 历史时期
        characterTraits: string; // 全局人物特征
        baseImageStyle: string; // 全局基础画面风格
    };
}

export class ScriptParser {
    constructor(private context: Context<ScriptParserInputs, ScriptParserOutputs>) { }
    async parseScript(params: ScriptParserInputs): Promise<ScriptParserOutputs> {
        this.context.reportLog('Starting script parsing...', 'stdout');

        const { content } = params;
        const scenes = await this.parseScenes(content);
        const metadata = await this.extractMetadata(content);

        await this.context.reportProgress(100);

        return {
            scenes,
            metadata
        };
    }

    private async parseScenes(content: string): Promise<ScriptScene[]> {
        const scenes: ScriptScene[] = []

        // 按场景分割文本
        const sceneMatches = content.match(/场景\d+:[\s\S]*?(?=场景\d+:|$)/g);

        if (!sceneMatches) {
            this.context.reportLog("No scenes found in script text", "stderr");
            return []
        }

        for (let i = 0; i < sceneMatches.length; i++) {
            const sceneText = sceneMatches[i].trim();
            // 提取场景号
            const sceneNumberMatch = sceneText.match(/场景(\d+):/);
            const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[1]) : i + 1;

            // 移除场景标识符，只保留场景内容
            const sceneContent = sceneText.replace(/场景\d+:/, '').trim();

            const scene = this.parseSceneBlock(sceneContent, String(sceneNumber));
            if (scene) {
                scenes.push(scene);
            }

            const progress = ((i + 1) / sceneMatches.length) * 100;
            await this.context.reportProgress(progress);
        }

        return scenes;
    }

    private parseSceneBlock(block: string, id: string): ScriptScene | null {
        const lines = block.split('\n').map(line => line.trim()).filter(line => line);

        let description = '';
        let narration = '';
        let visualPrompt = '';
        let estimatedDuration = 10; // 默认10秒

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('描述:')) {
                description = trimmedLine.substring(3).trim();
            } else if (trimmedLine.startsWith('解说词:')) {
                narration = trimmedLine.substring(4).trim();
            } else if (trimmedLine.startsWith('视觉提示:')) {
                visualPrompt = trimmedLine.substring(5).trim();
            } else if (trimmedLine.startsWith('时长:')) {
                const durationMatch = line.match(/(\d+)/);
                if (durationMatch) {
                    estimatedDuration = parseInt(durationMatch[1]);
                }
            }
        }

        if (!description || !narration) {
            console.warn(`Scene ${id} missing required fields, skipping`);
            return null;
        }

        return {
            id,
            description,
            narration,
            visualPrompt,
            estimatedDuration
        };
    }

    private async extractMetadata(content: string): Promise<{
        historicalPeriod: string;
        characterTraits: string;
        baseImageStyle: string;
    }> {
        const historicalPeriod = this.parseHistoricalPeriod(content);
        const baseImageStyle = this.parseBaseImageStyle(content);
        const characterTraits = this.parseCharacterTraits(content);
        return {
            historicalPeriod,
            characterTraits,
            baseImageStyle
        };
    }

    private parseBaseImageStyle(content: string): string {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            if (line.startsWith('基础画面风格:')) {
                return line.substring(7).trim();
            }
        }

        return '';
    }

    private parseHistoricalPeriod(content: string): string {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            if (line.startsWith('历史时期:')) {
                return line.substring(5).trim();
            }
        }

        return '';
    }

    private parseCharacterTraits(content: string): string {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            if (line.startsWith('人物特征:')) {
                return line.substring(5).trim();
            }
        }

        return '';
    }
}

import { Context } from "@oomol/types/oocana";

export interface ScriptScene {
    id: number;
    description: string;
    narration: string;
    visualPrompt: string;
    characterTraits: string; // 人物特征
    baseImageStyle: string; // 基础画面风格
    duration: number;
}

export interface ScriptParserInputs {
    scriptText: string;
}

export interface ScriptParserOutputs {
    scenes: ScriptScene[];
}

export class ScriptParser {
    async parseScript(
        params: ScriptParserInputs,
        context: Context<ScriptParserInputs, ScriptParserOutputs>
    ): Promise<ScriptParserOutputs> {
        console.log("Starting script parsing...");
        context.reportProgress(0);

        const { scriptText } = params;
        const scenes: ScriptScene[] = [];

        // 按场景分割文本
        const sceneBlocks = scriptText.split(/场景\d+:/).filter(block => block.trim());

        for (let i = 0; i < sceneBlocks.length; i++) {
            const block = sceneBlocks[i].trim();
            const scene = this.parseSceneBlock(block, i + 1);
            if (scene) {
                scenes.push(scene);
            }

            const progress = ((i + 1) / sceneBlocks.length) * 100;
            context.reportProgress(progress);
        }

        const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

        console.log(`✓ Parsed ${scenes.length} scenes, total duration: ${totalDuration}s`);

        return { scenes };
    }

    private parseSceneBlock(block: string, id: number): ScriptScene | null {
        const lines = block.split('\n').map(line => line.trim()).filter(line => line);

        let description = '';
        let narration = '';
        let visualPrompt = '';
        let characterTraits = '';
        let baseImageStyle = '';
        let duration = 10; // 默认10秒

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('描述:')) {
                description = trimmedLine.substring(3).trim();
            } else if (trimmedLine.startsWith('解说词:')) {
                narration = trimmedLine.substring(4).trim();
            } else if (trimmedLine.startsWith('视觉提示:')) {
                visualPrompt = trimmedLine.substring(5).trim();
            } else if (trimmedLine.startsWith('人物特征:')) {
                characterTraits = trimmedLine.substring(5).trim();
            } else if (trimmedLine.startsWith('基础画面风格:')) {
                baseImageStyle = trimmedLine.substring(7).trim();
            } else if (trimmedLine.startsWith('时长:')) {
                const durationMatch = line.match(/(\d+)/);
                if (durationMatch) {
                    duration = parseInt(durationMatch[1]);
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
            characterTraits,
            baseImageStyle,
            duration
        };
    }
}

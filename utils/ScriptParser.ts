import { Context } from "@oomol/types/oocana";

export interface ScriptScene {
    id: number;
    description: string;
    narration: string;
    visualPrompt: string;
    duration: number;
}

export interface ScriptParserInputs {
    scriptText: string;
}

export interface ScriptParserOutputs {
    scenes: ScriptScene[];
    imagePromptOptions: {
        historicalPeriod: string; // 历史时期
        characterTraits: string; // 全局人物特征
        baseImageStyle: string; // 全局基础画面风格
    }
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

        const historicalPeriod = this.parseHistoricalPeriod(scriptText);
        const characterTraits = this.parseCharacterTraits(scriptText);
        const baseImageStyle = this.parseBaseImageStyle(scriptText);

        // 按场景分割文本
        const sceneMatches = scriptText.match(/场景\d+:[\s\S]*?(?=场景\d+:|$)/g);

        if (!sceneMatches) {
            console.warn("No scenes found in script text");
            return {
                scenes: [],
                imagePromptOptions: {
                    historicalPeriod,
                    characterTraits,
                    baseImageStyle
                }
            };
        }


        for (let i = 0; i < sceneMatches.length; i++) {
            const sceneText = sceneMatches[i].trim();
            // 提取场景号
            const sceneNumberMatch = sceneText.match(/场景(\d+):/);
            const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[1]) : i + 1;

            // 移除场景标识符，只保留场景内容
            const sceneContent = sceneText.replace(/场景\d+:/, '').trim();

            const scene = this.parseSceneBlock(sceneContent, sceneNumber);
            if (scene) {
                scenes.push(scene);
            }

            const progress = ((i + 1) / sceneMatches.length) * 100;
            context.reportProgress(progress);
        }

        const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

        console.log(`✓ Parsed ${scenes.length} scenes, total duration: ${totalDuration}s`);
        console.log(`✓ Historical period: ${historicalPeriod}`);
        console.log(`✓ Character traits: ${characterTraits}`);
        console.log(`✓ Base image style: ${baseImageStyle}`);

        return {
            scenes,
            imagePromptOptions: {
                historicalPeriod, characterTraits, baseImageStyle
            }
        };
    }

    private parseBaseImageStyle(scriptText: string): string {
        const lines = scriptText.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            if (line.startsWith('基础画面风格:')) {
                return line.substring(7).trim();
            }
        }

        return '';
    }

    private parseHistoricalPeriod(scriptText: string): string {
        const lines = scriptText.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            if (line.startsWith('历史时期:')) {
                return line.substring(5).trim();
            }
        }

        return '';
    }

    private parseCharacterTraits(scriptText: string): string {
        const lines = scriptText.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            if (line.startsWith('人物特征:')) {
                return line.substring(5).trim();
            }
        }

        return '';
    }

    private parseSceneBlock(block: string, id: number): ScriptScene | null {
        const lines = block.split('\n').map(line => line.trim()).filter(line => line);

        let description = '';
        let narration = '';
        let visualPrompt = '';
        let duration = 10; // 默认10秒

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
            duration
        };
    }
}

//#region generated meta
type Inputs = {
    transcriptString: string;
};
type Outputs = {
    audioAssets: Record<string, any>[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function (
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    if (!params.transcriptString.trim()) {
        throw new Error('UnExpect Output')
    }
    let transcripts;
    try {
        // 清理可能的格式问题
        let cleanOutput = params.transcriptString.trim();
        cleanOutput = cleanOutput.replace(/```json\s*|\s*```/g, '');
        const jsonMatch = cleanOutput.match(/\[.*\]/s);
        if (jsonMatch) {
            cleanOutput = jsonMatch[0];
        }

        transcripts = JSON.parse(cleanOutput) as {
            sceneId: string;
            sentences: string[];
        };

        // 验证数据结构
        if (!Array.isArray(transcripts)) {
            throw new Error('返回数据不是数组格式');
        }
    } catch (error) {
        console.error('JSON 解析失败:', error);
        console.error('原始输出:', params.transcriptString);
        throw new Error('Invalid JSON output');
    }

    return {
        audioAssets: params.audioAssets.map(i => {
            const transcript = transcripts.find(script =>
                script.id === i.id &&
                script.sentences &&
                Array.isArray(script.sentences)
            );
            return {
                ...i,
                sentences: transcript.sentences || []
            }
        })
    }
};

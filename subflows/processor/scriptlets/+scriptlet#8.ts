//#region generated meta
type Inputs = {
    scenes: { id: string; description: string; narration: string; visualPrompt: string; estimatedDuration: number }[];
};
type Outputs = {
    texts: { id: string; content: string }[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function (
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    const { scenes } = params;

    const texts = scenes.map(scene => ({
        id: scene.id,
        content: scene.narration
    }))

    return { texts };
};
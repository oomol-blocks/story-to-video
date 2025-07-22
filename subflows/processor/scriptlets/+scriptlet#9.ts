//#region generated meta
type Inputs = {
    audioAssets: Record<string, any>[];
};
type Outputs = {
    texts: { id: string; content: string; timing: string }[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function (
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {
    const { audioAssets } = params;

    const texts = audioAssets.map(asset => ({
        id: asset.id,
        content: asset.transcript,
        sentences: asset.sentences,
        timing: asset.timing
    }));

    return { texts };
};

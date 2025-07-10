//#region generated meta
type Inputs = {
    audioAssets: {
        id: string; duration: number; timing: {
            startTime: number;
            endTime: number;
            duration: number;
        }; transcript: string; sentences: []
    }[];
};
type Outputs = {
    texts: {
        id: string; content: string; timing: {
            startTime: number;
            endTime: number;
            duration: number;
        };
    }[] | null;
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
    }))

    return { texts }
};

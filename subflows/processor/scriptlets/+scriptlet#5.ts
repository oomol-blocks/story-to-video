//#region generated meta
type Inputs = {
    audioAssets: Record<string, any>[];
};
type Outputs = {
    scriptList: any[] | null;
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function (
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    return {
        scriptList: params.audioAssets.map(i => ({
            transcript: i.transcript,
            id: i.id
        })
        )
    }
};

//#region generated meta
type Inputs = {
    videoAsset: { filePath: string; duration: number; resolution: string; fileSize: number };
};
type Outputs = {
    output: string;
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function(
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {
    return {
        output: params.videoAsset.filePath
    }
};

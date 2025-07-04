//#region generated meta
type Inputs = {
    audioAssets: { sceneId: number; filePath: string; duration: number; transcript: string }[];
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
        scriptList: params.audioAssets.map(i => {
            return {
                transcipt: i.transcript,
                sceneId: i.sceneId
            }
        }
        )
    }
};

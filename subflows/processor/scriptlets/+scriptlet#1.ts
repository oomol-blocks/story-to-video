//#region generated meta
type Inputs = {
    audioAssets: Record<string, any>[];
};
type Outputs = {
    durationList: Record<string, any>[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";

export default async function(
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {
    return {
        // TODO: 如果没有输入 audioAssets 文件，则应该根据场景的估计数据传入
        durationList: params.audioAssets.map(i => ({
            id: i.id,
            duration: i.timing.duration
        }))
    }
};

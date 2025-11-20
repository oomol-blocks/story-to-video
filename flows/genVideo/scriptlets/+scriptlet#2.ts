//#region generated meta
type Inputs = {
    array: any[];
};
type Outputs = {
    imageAssets: Record<string, any>[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";
import * as path from "node:path";

export default async function (
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    const files = params.array;

    try {
        const imageAssets = files
            .sort() // 按文件名排序
            .map((filePath, index) => {
                const ext = filePath.split('.').pop();

                return {
                    id: `image_${index + 1}`,
                    url: filePath,
                    filePath: filePath,
                    format: ext === 'jpg' ? 'jpeg' : ext,
                    prompt: "",
                    style: "",
                    createdAt: new Date()
                };
            });

        return { imageAssets }
    } catch (error) {
        throw new Error(`Failed to get images info: ${error.message}`);
    }
};

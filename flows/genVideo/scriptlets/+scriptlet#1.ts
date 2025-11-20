//#region generated meta
type Inputs = {
    value: string;
};
type Outputs = {
    imagePaths: string[];
};
//#endregion

import type { Context } from "@oomol/types/oocana";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export default async function(
    params: Inputs,
    context: Context<Inputs, Outputs>
): Promise<Partial<Outputs> | undefined | void> {

    const folderPath = params.value;

    if (!folderPath) {
        throw new Error("Folder path is required");
    }

    try {
        // 检查文件夹是否存在
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${folderPath}`);
        }

        // 读取文件夹中的所有文件
        const files = await fs.readdir(folderPath);

        console.log('files: ', files)

        const imagePaths = files.map(file => path.join(folderPath, file));

        console.log('imagePaths: ', imagePaths)


        if (imagePaths.length === 0) {
            context.reportLog(`No image files found in folder: ${folderPath}`, "stdout");
        } else {
            context.reportLog(`Found ${imagePaths.length} image(s) in folder: ${folderPath}`, "stdout");
        }

        return { imagePaths };
    } catch (error) {
        throw new Error(`Failed to read folder: ${error.message}`);
    }
};

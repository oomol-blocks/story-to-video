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
        // check if the video file exists
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${folderPath}`);
        }

        // read all files in the folder
        const files = await fs.readdir(folderPath);
        const imagePaths = files.map(file => path.join(folderPath, file)).filter(i => {
            const ext = path.extname(i).toLocaleLowerCase();
            return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
        });

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

import type { Context } from "@oomol/types/oocana";
import { ImageGeneratorInputs, ImageGeneratorOutputs, ImageGenerator } from "~/utils/ImageGenarator";

export default async function generateImages(
    params: ImageGeneratorInputs,
    context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
): Promise<ImageGeneratorOutputs> {
    const generator = new ImageGenerator();
    // return await generator.generateImages(params, context);

    const raw = [
        {
            sceneId: 1,
            filePath: "/oomol-driver/oomol-storage/output2/image_1.png",
            prompt: "周瑜看到诸葛亮比自己聪明，心里很不服气。他假装友好地说：\"军中缺箭，请先生十天内造十万支箭。\"这根本不可能完成！"
        }, {
            sceneId: 2,
            filePath: "/oomol-driver/oomol-storage/output2/image_2.png",
            prompt: "诸葛亮神秘地对鲁肃说：\"借我二十条船，每船三十士兵，青布幔子扎满草人。记住，千万别告诉周瑜！\""
        }, {
            sceneId: 3,
            filePath: "/oomol-driver/oomol-storage/output2/image_3.png",
            prompt: "第三天凌晨，江上大雾弥漫。诸葛亮命令船队擂鼓呐喊，曹操以为敌军来袭，下令万箭齐发！"
        }, {
            sceneId: 4,
            filePath: "/oomol-driver/oomol-storage/output2/image_4.png",
            prompt: "太阳升起时，草人身上插满了箭！诸葛亮轻松完成任务，周瑜目瞪口呆：\"先生真是神机妙算啊！\""
        }
    ];

    for (let i = 0; i < raw.length; i++) {
        const basePrompt = generator.getBaseImagePrompt();
        const fullPrompt = `${basePrompt}\n\n场景描述: ${raw[i].prompt}`;
        raw[i].prompt = fullPrompt
    }
    return {
        imageAssets: raw
    };
}

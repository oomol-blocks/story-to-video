import type { Context } from "@oomol/types/oocana";
import { AudioGenerator, AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";

export default async function generateAudio(
    params: AudioGeneratorInputs,
    context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>
): Promise<AudioGeneratorOutputs> {
    // const generator = new AudioGenerator();
    // return await generator.generateAudio(params, context);

    return {
        audioAssets: [
            {
                sceneId: 1,
                filePath: "/oomol-driver/oomol-storage/output2/audio_1.mp3",
                duration: 15,
                transcript: "周瑜看到诸葛亮比自己聪明，心里很不服气。他假装友好地说：\"军中缺箭，请先生十天内造十万支箭。\"这根本不可能完成！"
            }, {
                sceneId: 2,
                filePath: "/oomol-driver/oomol-storage/output2/audio_2.mp3",
                duration: 12,
                transcript: "诸葛亮神秘地对鲁肃说：\"借我二十条船，每船三十士兵，青布幔子扎满草人。记住，千万别告诉周瑜！\""
            }, {
                sceneId: 3,
                filePath: "/oomol-driver/oomol-storage/output2/audio_3.mp3",
                duration: 18,
                transcript: "第三天凌晨，江上大雾弥漫。诸葛亮命令船队擂鼓呐喊，曹操以为敌军来袭，下令万箭齐发！"
            }, {
                sceneId: 4,
                filePath: "/oomol-driver/oomol-storage/output2/audio_4.mp3",
                duration: 15,
                transcript: "太阳升起时，草人身上插满了箭！诸葛亮轻松完成任务，周瑜目瞪口呆：\"先生真是神机妙算啊！\""
            }
        ]
    }
}

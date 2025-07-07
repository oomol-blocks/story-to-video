import type { Context } from "@oomol/types/oocana";
import { AudioGenerator, AudioGeneratorInputs, AudioGeneratorOutputs } from "~/utils/AudioGenerator";

export default async function generateAudio(
    params: AudioGeneratorInputs,
    context: Context<AudioGeneratorInputs, AudioGeneratorOutputs>
): Promise<AudioGeneratorOutputs> {
    const generator = new AudioGenerator();
    const audioAsset = await generator.generateAudio(params, context);
    console.log("audioAsset: ", audioAsset)
    return audioAsset;
    // return {
    //     audioAssets: [
    //         {
    //             sceneId: 1,
    //             filePath: '/oomol-driver/oomol-storage/output2/audio_1.mp3',
    //             duration: 12.67,
    //             transcript: '周瑜嫉妒诸葛亮的才能，想为难他。他设下宴席，假装友好地说："军中缺箭，请先生十日内造十万支箭。"诸葛亮却笑着说："三天就够了！"',
    //             sentences: []
    //         },
    //         {
    //             sceneId: 2,
    //             filePath: '/oomol-driver/oomol-storage/output2/audio_2.mp3',
    //             duration: 9.55,
    //             transcript: '诸葛亮找来二十条船，每船扎满草人。鲁肃很担心："这能行吗？"诸葛亮神秘一笑："子敬且看明日好戏！"',
    //             sentences: []
    //         },
    //         {
    //             sceneId: 3,
    //             filePath: '/oomol-driver/oomol-storage/output2/audio_3.mp3',
    //             duration: 10.1,
    //             transcript: '第三天凌晨，江上大雾弥漫。诸葛亮命船队擂鼓呐喊，曹军以为敌军来袭，万箭齐发！箭都扎在草人上，像刺猬一样！',
    //             sentences: []
    //         },
    //         {
    //             sceneId: 4,
    //             filePath: '/oomol-driver/oomol-storage/output2/audio_4.mp3',
    //             duration: 10.08,
    //             transcript: '太阳升起时，诸葛亮带着十万支箭返回。周瑜目瞪口呆："先生真神人也！"诸葛亮摇着羽扇："略施小计而已。"',
    //             sentences: []
    //         }
    //     ]
    // }
}

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
                filePath: '/oomol-driver/oomol-storage/output2/audio_1.mp3',
                duration: 9.77,
                transcript: '周瑜嫉妒诸葛亮的才能，设下圈套。他假装请教："水上交战，什么武器最好？"诸葛亮微微一笑："当然是弓箭！"',
                sentences: []
            },
            {
                sceneId: 2,
                filePath: '/oomol-driver/oomol-storage/output2/audio_2.mp3',
                duration: 10.99,
                transcript: '周瑜突然变脸："那请先生十天内造十万支箭！"诸葛亮却淡定地说："三天就够了！"周瑜暗自得意，以为诸葛亮中计了。',
                sentences: []
            },
            {
                sceneId: 3,
                filePath: '/oomol-driver/oomol-storage/output2/audio_3.mp3',
                duration: 11.3,
                transcript: '诸葛亮找来鲁肃帮忙，准备二十条小船，扎满稻草人。鲁肃满脸疑惑："这能造箭？"诸葛亮神秘地眨眨眼："等着看好戏吧！"',
                sentences: []
            },
            {
                sceneId: 4,
                filePath: '/oomol-driver/oomol-storage/output2/audio_4.mp3',
                duration: 12.38,
                transcript: '大雾天，诸葛亮命船队擂鼓前进。曹操以为敌军来袭，急令放箭！箭如雨下，全都扎在稻草人上。诸葛亮哈哈大笑："多谢曹丞相赠箭！"',
                sentences: []
            },
            {
                sceneId: 5,
                filePath: '/oomol-driver/oomol-storage/output2/audio_5.mp3',
                duration: 10.58,
                transcript: '三天后，诸葛亮带着十万支箭归来。周瑜目瞪口呆："先生真神人也！"诸葛亮摇着羽扇："用智慧取胜，才是真本事！"',
                sentences: []
            }
        ]
    }
}

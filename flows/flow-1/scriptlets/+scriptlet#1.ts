import type { Context } from "@oomol/types/oocana";
import { ScriptParser, ScriptParserInputs, ScriptParserOutputs } from "~/utils/ScriptParser";

export default async function (
    params: ScriptParserInputs,
    context: Context<ScriptParserInputs, ScriptParserOutputs>
): Promise<Partial<ScriptParserOutputs>> {
    return {
        scenes: [
            {
                id: 1,
                description: '周瑜设宴邀请诸葛亮，暗中谋划',
                dialogue: '周瑜嫉妒诸葛亮的才能，设下圈套。他假装请教："水上交战，什么武器最好？"诸葛亮微微一笑："当然是弓箭！"',
                visualPrompt: '古色古香的军营帐篷内，周瑜举杯假笑，诸葛亮轻摇羽扇，两人中间摆着酒菜',
                duration: 20
            },
            {
                id: 2,
                description: '周瑜刁难诸葛亮',
                dialogue: '周瑜突然变脸："那请先生十天内造十万支箭！"诸葛亮却淡定地说："三天就够了！"周瑜暗自得意，以为诸葛亮中计了。',
                visualPrompt: '周瑜拍案而起面露凶相，诸葛亮从容不迫地摇扇子，背景是惊讶的侍从们',
                duration: 25
            },
            {
                id: 3,
                description: '诸葛亮准备草船',
                dialogue: '诸葛亮找来鲁肃帮忙，准备二十条小船，扎满稻草人。鲁肃满脸疑惑："这能造箭？"诸葛亮神秘地眨眨眼："等着看好戏吧！"',
                visualPrompt: '夜晚江边，工人们忙着扎稻草人，诸葛亮指着雾气弥漫的江面，鲁肃挠头不解',
                duration: 30
            },
            {
                id: 4,
                description: '草船借箭',
                dialogue: '大雾天，诸葛亮命船队擂鼓前进。曹操以为敌军来袭，急令放箭！箭如雨下，全都扎在稻草人上。诸葛亮哈哈大笑："多谢曹丞相赠箭！"',
                visualPrompt: '浓雾中隐约可见插满箭的草船，曹操在城楼上气急败坏，诸葛亮在船头开怀大笑',
                duration: 35
            },
            {
                id: 5,
                description: '周瑜目瞪口呆',
                dialogue: '三天后，诸葛亮带着十万支箭归来。周瑜目瞪口呆："先生真神人也！"诸葛亮摇着羽扇："用智慧取胜，才是真本事！"',
                visualPrompt: '军营前堆满箭支，周瑜张大嘴巴，诸葛亮潇洒转身，羽扇轻摇',
                duration: 25
            }
        ]
    }
    // const parser = new ScriptParser()
    // return await parser.parseScript(params, context);
};

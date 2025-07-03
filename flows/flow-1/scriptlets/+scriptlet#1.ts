import type { Context } from "@oomol/types/oocana";
import { ScriptParser, ScriptParserInputs, ScriptParserOutputs } from "~/utils/ScriptParser";

export default async function (
    params: ScriptParserInputs,
    context: Context<ScriptParserInputs, ScriptParserOutputs>
): Promise<Partial<ScriptParserOutputs>> {
    return {
        scenes: [
            {
                "id": 1,
                "description": "周瑜设下计谋要陷害诸葛亮",
                "dialogue": "周瑜嫉妒诸葛亮的才能，想借造箭为难他。他要求诸葛亮在十天内造出十万支箭，这根本不可能完成！",
                "visualPrompt": "周瑜在军帐中阴险地笑着，诸葛亮淡定地摇着羽扇，背景是古代军营地图",
                "duration": 15
            },
            {
                "id": 2,
                "description": "诸葛亮准备草船",
                "dialogue": "诸葛亮不但没拒绝，还主动缩短到三天！他秘密准备二十条小船，扎满稻草人，这是要干什么呢？",
                "visualPrompt": "夜晚码头，士兵们忙碌地往小船上扎稻草人，诸葛亮站在岸边微笑",
                "duration": 20
            },
            {
                "id": 3,
                "description": "大雾中借箭",
                "dialogue": "第三天凌晨，江上大雾弥漫。诸葛亮带着草船靠近曹营，士兵们擂鼓呐喊。曹操以为敌军来袭，下令万箭齐发！",
                "visualPrompt": "浓雾中隐约可见草船轮廓，箭如雨下扎在稻草人上，诸葛亮在船头淡定喝茶",
                "duration": 25
            },
            {
                "id": 4,
                "description": "满载而归",
                "dialogue": "太阳升起时，诸葛亮带着十万多支箭凯旋！周瑜目瞪口呆，原来他早算准了大雾天气和曹操的反应。",
                "visualPrompt": "阳光穿透雾气，草船上插满箭支像刺猬，周瑜在岸边张大嘴巴",
                "duration": 20
            },
            {
                "id": 5,
                "description": "诸葛亮解释计谋",
                "dialogue": "\"这些箭都是曹丞相送的！\"诸葛亮笑着说。周瑜终于心服口服，承认诸葛亮确实神机妙算。",
                "visualPrompt": "诸葛亮指着箭支开怀大笑，周瑜抱拳行礼，背景是满载箭支的船只特写",
                "duration": 15
            }
        ]
    }
    // const parser = new ScriptParser()
    // return await parser.parseScript(params, context);
};

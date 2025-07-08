import type { Context } from "@oomol/types/oocana";
import { ScriptParser, ScriptParserInputs, ScriptParserOutputs } from "~/utils/ScriptParser";

export default async function (
    params: ScriptParserInputs,
    context: Context<ScriptParserInputs, ScriptParserOutputs>
): Promise<Partial<ScriptParserOutputs>> {
    const parser = new ScriptParser();
    const parsedScript = await parser.parseScript(params, context);
    return parsedScript;

    // return {
    //     scenes: [
    //         {
    //             id: 1,
    //             description: '周瑜在军营中设宴，与诸葛亮商议军事',
    //             narration: '周瑜嫉妒诸葛亮的才能，想为难他。他设下宴席，假装友好地说："军中缺箭，请先生十日内造十万支箭。"诸葛亮却笑着说："三天就够了！"',
    //             visualPrompt: '军营大帐内，周瑜坐在主位，诸葛亮对坐。桌上摆着酒菜，帐外可见巡逻士兵。周瑜眼神狡黠，诸葛亮轻摇羽扇。',
    //             characterTraits: '周瑜穿红色铠甲，面容英俊但眼神阴险；诸葛亮着蓝色长袍，手持羽扇，神态从容',
    //             baseImageStyle: '古风手绘，暖色调，细节精致',
    //             duration: 25
    //         },
    //         {
    //             id: 2,
    //             description: '诸葛亮在江边准备草船',
    //             narration: '诸葛亮找来二十条船，每船扎满草人。鲁肃很担心："这能行吗？"诸葛亮神秘一笑："子敬且看明日好戏！"',
    //             visualPrompt: '夜晚江边，士兵们忙着扎草人。诸葛亮站在岸边指挥，鲁肃在一旁疑惑地摸着胡子。月光照在江面上波光粼粼。',
    //             characterTraits: '诸葛亮依然持羽扇，鲁肃穿文官服饰，圆脸微胖',
    //             baseImageStyle: '延续古风，转为冷蓝色调表现夜晚',
    //             duration: 20
    //         },
    //         {
    //             id: 3,
    //             description: '草船借箭的惊险过程',
    //             narration: '第三天凌晨，江上大雾弥漫。诸葛亮命船队擂鼓呐喊，曹军以为敌军来袭，万箭齐发！箭都扎在草人上，像刺猬一样！',
    //             visualPrompt: '浓雾中的江面，草船逼近曹营。曹军弓箭手在城墙上放箭，箭如雨下。特写草人渐渐插满箭支。',
    //             characterTraits: '曹军士兵穿黑色铠甲，惊慌失措；诸葛亮在船头淡定微笑',
    //             baseImageStyle: '动态感强的雾景，箭矢有运动轨迹',
    //             duration: 30
    //         },
    //         {
    //             id: 4,
    //             description: '满载而归的胜利场景',
    //             narration: '太阳升起时，诸葛亮带着十万支箭返回。周瑜目瞪口呆："先生真神人也！"诸葛亮摇着羽扇："略施小计而已。"',
    //             visualPrompt: '晨光中船队靠岸，士兵们欢笑着拔箭。周瑜在岸边震惊地张大嘴，诸葛亮潇洒下船。',
    //             characterTraits: '周瑜表情夸张，诸葛亮保持从容',
    //             baseImageStyle: '金色晨光，欢乐氛围',
    //             duration: 25
    //         }
    //     ]
    // }
};

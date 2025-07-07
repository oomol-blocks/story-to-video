import type { Context } from "@oomol/types/oocana";
import { ImageGeneratorInputs, ImageGeneratorOutputs, ImageGenerator } from "~/utils/ImageGenarator";

export default async function generateImages(
    params: ImageGeneratorInputs,
    context: Context<ImageGeneratorInputs, ImageGeneratorOutputs>
): Promise<ImageGeneratorOutputs> {
    // const generator = new ImageGenerator();
    // const imageAssets = await generator.generateImages(params, context);
    // console.log('image assets: ', imageAssets);
    // return imageAssets;
    return {
        imageAssets: [
            {
                sceneId: 1,
                filePath: '/oomol-driver/oomol-storage/output2/image_1.png',
                prompt: '生成中国古代三国时期的漫画风格插图，要求：\n' +
                    '\n' +
                    '风格特点：\n' +
                    '- 卡通漫画风格，色彩鲜艳\n' +
                    '- 人物造型可爱，表情生动\n' +
                    '- 背景简洁但有古代特色\n' +
                    '- 整体画面适合儿童观看\n' +
                    '\n' +
                    '技术要求：\n' +
                    '- 16:9横版构图\n' +
                    '- 高清画质\n' +
                    '- 色彩饱和度适中\n' +
                    '- 避免过于复杂的细节\n' +
                    '\n' +
                    '人物特征：\n' +
                    '- 诸葛亮：白色羽扇，智者形象\n' +
                    '- 周瑜：年轻将军，略显急躁\n' +
                    '- 曹军：远景中的模糊身影\n' +
                    '- 鲁肃：憨厚老实的样子\n' +
                    '\n' +
                    '环境设定：\n' +
                    '- 古代军营、江面、战船\n' +
                    '- 体现三国时期的历史背景\n' +
                    '- 适当的雾气和水墨风格元素\n' +
                    '\n' +
                    '场景描述: 古色古香的军营帐篷内，周瑜举杯假笑，诸葛亮轻摇羽扇，两人中间摆着酒菜',
                resolution: "1024x1792"
            },
            {
                sceneId: 2,
                filePath: '/oomol-driver/oomol-storage/output2/image_2.png',
                prompt: '生成中国古代三国时期的漫画风格插图，要求：\n' +
                    '\n' +
                    '风格特点：\n' +
                    '- 卡通漫画风格，色彩鲜艳\n' +
                    '- 人物造型可爱，表情生动\n' +
                    '- 背景简洁但有古代特色\n' +
                    '- 整体画面适合儿童观看\n' +
                    '\n' +
                    '技术要求：\n' +
                    '- 16:9横版构图\n' +
                    '- 高清画质\n' +
                    '- 色彩饱和度适中\n' +
                    '- 避免过于复杂的细节\n' +
                    '\n' +
                    '人物特征：\n' +
                    '- 诸葛亮：白色羽扇，智者形象\n' +
                    '- 周瑜：年轻将军，略显急躁\n' +
                    '- 曹军：远景中的模糊身影\n' +
                    '- 鲁肃：憨厚老实的样子\n' +
                    '\n' +
                    '环境设定：\n' +
                    '- 古代军营、江面、战船\n' +
                    '- 体现三国时期的历史背景\n' +
                    '- 适当的雾气和水墨风格元素\n' +
                    '\n' +
                    '场景描述: 周瑜拍案而起面露凶相，诸葛亮从容不迫地摇扇子，背景是惊讶的侍从们',
                resolution: "1024x1792"
            },
            {
                sceneId: 3,
                filePath: '/oomol-driver/oomol-storage/output2/image_3.png',
                prompt: '生成中国古代三国时期的漫画风格插图，要求：\n' +
                    '\n' +
                    '风格特点：\n' +
                    '- 卡通漫画风格，色彩鲜艳\n' +
                    '- 人物造型可爱，表情生动\n' +
                    '- 背景简洁但有古代特色\n' +
                    '- 整体画面适合儿童观看\n' +
                    '\n' +
                    '技术要求：\n' +
                    '- 16:9横版构图\n' +
                    '- 高清画质\n' +
                    '- 色彩饱和度适中\n' +
                    '- 避免过于复杂的细节\n' +
                    '\n' +
                    '人物特征：\n' +
                    '- 诸葛亮：白色羽扇，智者形象\n' +
                    '- 周瑜：年轻将军，略显急躁\n' +
                    '- 曹军：远景中的模糊身影\n' +
                    '- 鲁肃：憨厚老实的样子\n' +
                    '\n' +
                    '环境设定：\n' +
                    '- 古代军营、江面、战船\n' +
                    '- 体现三国时期的历史背景\n' +
                    '- 适当的雾气和水墨风格元素\n' +
                    '\n' +
                    '场景描述: 夜晚江边，工人们忙着扎稻草人，诸葛亮指着雾气弥漫的江面，鲁肃挠头不解',
                resolution: "1024x1792"
            },
            {
                sceneId: 4,
                filePath: '/oomol-driver/oomol-storage/output2/image_4.png',
                prompt: '生成中国古代三国时期的漫画风格插图，要求：\n' +
                    '\n' +
                    '风格特点：\n' +
                    '- 卡通漫画风格，色彩鲜艳\n' +
                    '- 人物造型可爱，表情生动\n' +
                    '- 背景简洁但有古代特色\n' +
                    '- 整体画面适合儿童观看\n' +
                    '\n' +
                    '技术要求：\n' +
                    '- 16:9横版构图\n' +
                    '- 高清画质\n' +
                    '- 色彩饱和度适中\n' +
                    '- 避免过于复杂的细节\n' +
                    '\n' +
                    '人物特征：\n' +
                    '- 诸葛亮：白色羽扇，智者形象\n' +
                    '- 周瑜：年轻将军，略显急躁\n' +
                    '- 曹军：远景中的模糊身影\n' +
                    '- 鲁肃：憨厚老实的样子\n' +
                    '\n' +
                    '环境设定：\n' +
                    '- 古代军营、江面、战船\n' +
                    '- 体现三国时期的历史背景\n' +
                    '- 适当的雾气和水墨风格元素\n' +
                    '\n' +
                    '场景描述: 浓雾中隐约可见插满箭的草船，曹操在城楼上气急败坏，诸葛亮在船头开怀大笑',
                resolution: "1024x1792"
            },
            {
                sceneId: 5,
                filePath: '/oomol-driver/oomol-storage/output2/image_5.png',
                prompt: '生成中国古代三国时期的漫画风格插图，要求：\n' +
                    '\n' +
                    '风格特点：\n' +
                    '- 卡通漫画风格，色彩鲜艳\n' +
                    '- 人物造型可爱，表情生动\n' +
                    '- 背景简洁但有古代特色\n' +
                    '- 整体画面适合儿童观看\n' +
                    '\n' +
                    '技术要求：\n' +
                    '- 16:9横版构图\n' +
                    '- 高清画质\n' +
                    '- 色彩饱和度适中\n' +
                    '- 避免过于复杂的细节\n' +
                    '\n' +
                    '人物特征：\n' +
                    '- 诸葛亮：白色羽扇，智者形象\n' +
                    '- 周瑜：年轻将军，略显急躁\n' +
                    '- 曹军：远景中的模糊身影\n' +
                    '- 鲁肃：憨厚老实的样子\n' +
                    '\n' +
                    '环境设定：\n' +
                    '- 古代军营、江面、战船\n' +
                    '- 体现三国时期的历史背景\n' +
                    '- 适当的雾气和水墨风格元素\n' +
                    '\n' +
                    '场景描述: 军营前堆满箭支，周瑜张大嘴巴，诸葛亮潇洒转身，羽扇轻摇',
                resolution: "1024x1792"
            }
        ]
    }
}

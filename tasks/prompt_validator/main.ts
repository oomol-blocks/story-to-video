import { ScriptFormatValidator } from "~/core/ScriptValidator";

type Inputs = {
    prompt: string;
}

type Outputs = {
    prompt: string
}

function validateScriptContent(params: Inputs): Outputs | void {
    const validator = new ScriptFormatValidator();
    const result = validator.validateScript(params.prompt);

    if (result.errors.length > 0) {
        const errorMessage = [
            '脚本格式验证失败：',
            ...result.errors.map((error, index) => `${index + 1}. ${error}`),
            '',
            '请修正以上错误后重试。'
        ].join('\n');
        
        throw new Error(errorMessage);
    }
}

export default validateScriptContent;

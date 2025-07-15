import type { Context } from "@oomol/types/oocana";
import { ScriptParser, ScriptParserInputs, ScriptParserOutputs } from "~/utils/ScriptParser";

export default async function (
    params: ScriptParserInputs,
    context: Context<ScriptParserInputs, ScriptParserOutputs>
): Promise<Partial<ScriptParserOutputs>> {
    const parser = new ScriptParser(context);
    return await parser.parseScript(params);
};

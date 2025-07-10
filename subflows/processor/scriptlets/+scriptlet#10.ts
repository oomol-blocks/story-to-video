import type { Context } from "@oomol/types/oocana";
import { AudioExtender, AudioExtenderInputs, AudioExtenderOutputs } from "~/utils/AudioExtender";

export default async function extendAudio(
    params: AudioExtenderInputs,
    context: Context<AudioExtenderInputs, AudioExtenderOutputs>
): Promise<AudioExtenderOutputs> {
    const { targetDuration, audioAssets } = params;

    const needsExtension = audioAssets.some(
        asset => asset.timing.duration < targetDuration
    );

    if (!needsExtension) {
        context.reportLog('All audio assets already meet target duration, no extension needed', 'stdout');
        return { audioAssets };
    }

    const extender = new AudioExtender(context);

    const extenderResult = await extender.extendAudioAssets({
        audioAssets: audioAssets,
        targetDuration: targetDuration
    });

    return extenderResult;
}

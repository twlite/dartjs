import { injectSmoothVolume } from "./smoothVolume/injection";

if (!("DARTJS_DISABLE_INJECTION" in process.env)) {
    injectSmoothVolume();
}

export { DartVoiceManager } from "./core/DartVoiceManager";
export { StreamDispatcher } from "./core/StreamDispatcher";
export { VoiceConnection } from "./core/VoiceConnection";
export { VoiceReceiver } from "./core/VoiceReceiver";
export { VolumeTransformer, VolumeTransformerOptions } from "./smoothVolume/VolumeTransformer";
export { injectSmoothVolume };
export * from "./types/types";
export * from "./Utils/Util";

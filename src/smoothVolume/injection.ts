import { VolumeTransformer as VolumeTransformerMock } from "./VolumeTransformer";

export function injectSmoothVolume() {
    try {
        /* eslint-disable */
        // @ts-ignore
        const mod = require("prism-media") as typeof import("prism-media") & { VolumeTransformer: typeof VolumeTransformerMock };
        /* eslint-enable */

        if (typeof mod.VolumeTransformer.hasSmoothing !== "boolean") {
            Reflect.set(mod, "VolumeTransformer", VolumeTransformerMock);
        }
    } catch {
        /* do nothing */
    }
}

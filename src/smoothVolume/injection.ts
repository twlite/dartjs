import { VolumeTransformer as VolumeTransformerMock } from "./VolumeTransformer";

export function injectSmoothVolume() {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const mod = require("prism-media") as typeof import("prism-media") & { VolumeTransformer: typeof VolumeTransformerMock };

        if (typeof mod.VolumeTransformer.hasSmoothing !== "boolean") {
            Reflect.set(mod, "VolumeTransformer", VolumeTransformerMock);
        }
    } catch {
        /* do nothing */
    }
}

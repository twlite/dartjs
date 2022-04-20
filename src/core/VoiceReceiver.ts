import { EndBehaviorType } from "@discordjs/voice";
import { Client, UserResolvable } from "discord.js";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { ReceiveStreamOptions, VoiceReceiverEvents } from "../types/types";
import VoiceConnection from "./VoiceConnection";
import prism from "prism-media";
import { PassThrough, Readable } from "stream";

export class VoiceReceiver extends EventEmitter<VoiceReceiverEvents> {
    constructor(public readonly client: Client<true>, public readonly connection: VoiceConnection) {
        super();
    }

    public cleanUp() {
        this.connection.voice.receiver.speaking.removeAllListeners("start");
        this.connection.voice.receiver.speaking.removeAllListeners("end");
    }

    /**
     * Create receiver stream
     * @param user The target user to listen to
     * @param options Receiver options
     */
    public createStream(user: UserResolvable, options: ReceiveStreamOptions = {}) {
        const _user = this.client.users.resolveId(user);
        options ??= { end: "silence", mode: "opus" };

        const passThrough = new PassThrough();
        const receiver = this.connection.voice?.receiver;

        if (!receiver.speaking.eventNames().includes("end"))
            receiver.speaking.on("end", (userId) => {
                this.emit("debug", `${userId} stopped speaking!`);
            });

        receiver.speaking.on("start", (userId) => {
            if (userId === _user) {
                const opusStream = receiver.subscribe(_user, {
                    end: {
                        behavior: options.end === "silence" ? EndBehaviorType.AfterSilence : EndBehaviorType.Manual,
                        duration: 100
                    }
                });

                setImmediate(() => {
                    if (options.mode === "pcm") {
                        const pcmStream = new prism.opus.Decoder({
                            channels: 2,
                            frameSize: 960,
                            rate: 48000
                        });

                        opusStream.pipe(pcmStream);
                        return pcmStream.pipe(passThrough);
                    } else {
                        return opusStream.pipe(passThrough);
                    }
                });
            }
        });

        return passThrough as Readable;
    }
}

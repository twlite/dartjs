import { joinVoiceChannel, entersState, VoiceConnectionStatus, VoiceConnection as VoiceConnectionNative } from "@discordjs/voice";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { VoiceChannels, VoiceEvents, VoiceConnectionData } from "../types/types";
import { catchError } from "../Utils/Util";
import type { Readable } from "stream";
import StreamDispatcher from "./StreamDispatcher";

export default class VoiceConnection extends EventEmitter<VoiceEvents> {
    public readonly client = this.options.channel.client;
    public readonly channel = this.options.channel;
    public dispatcher: StreamDispatcher = null;

    public constructor(public voice: VoiceConnectionNative, public readonly options: VoiceConnectionData) {
        super();

        this.voice.on("debug", (m) => void this.emit("debug", m));
        this.voice.on("error", (err) => void this.emit("error", err));
    }

    public disconnect() {
        this.voice.destroy();
    }

    public static createConnection(channel: VoiceChannels): Promise<VoiceConnection> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const [error, connection] = await catchError(() => VoiceConnection.joinChannel(channel));
            if (error) return reject(error);
            const vc = new VoiceConnection(connection, {
                channel
            });
            resolve(vc);
        });
    }

    public static joinChannel(channel: VoiceChannels): Promise<VoiceConnectionNative> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const rawconnection = joinVoiceChannel({
                guildId: channel.guild.id,
                channelId: channel.id,
                adapterCreator: channel.guild.voiceAdapterCreator
            });

            const [error, connection] = await catchError(() => {
                return entersState(rawconnection, VoiceConnectionStatus.Ready, 30_000);
            });
            if (error) return reject(error);
            resolve(connection);
        });
    }

    public play(stream: Readable | string) {
        if (!this.dispatcher) {
            const dispatcher = new StreamDispatcher(this);
            this.dispatcher = dispatcher;
        }

        this.dispatcher.playStream(stream);
        return this.dispatcher;
    }

    get status() {
        return this.voice.state.status;
    }
}

export { VoiceConnection };

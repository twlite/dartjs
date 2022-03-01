import { joinVoiceChannel, entersState, VoiceConnectionStatus, VoiceConnection as VoiceConnectionNative, DiscordGatewayAdapterCreator } from "@discordjs/voice";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { VoiceChannels, VoiceEvents, VoiceConnectionData, PlayOptions, VoiceJoinConfig } from "../types/types";
import { catchError } from "../Utils/Util";
import type { Readable } from "stream";
import StreamDispatcher from "./StreamDispatcher";
import type { DartVoiceManager } from "./DartVoiceManager";
import { VoiceReceiver } from "./VoiceReceiver";

export default class VoiceConnection extends EventEmitter<VoiceEvents> {
    public readonly client = this.options.channel.client;
    public readonly channel = this.options.channel;
    public dispatcher: StreamDispatcher = null;
    public readonly voiceManager = this.options.manager;
    public receiver = new VoiceReceiver(this.client, this);

    public constructor(public voice: VoiceConnectionNative, public readonly options: VoiceConnectionData) {
        super();
    }

    public get audioPlayer() {
        return this.dispatcher?.audioPlayer;
    }

    public disconnect() {
        try {
            this.dispatcher.removeAllListeners();
            this.receiver.removeAllListeners();
            this.voice.disconnect();
        } catch {
            /* noop */
        }
    }

    public destroy() {
        try {
            this.voiceManager.connections.delete(this.channel.guildId);
            this.dispatcher.removeAllListeners();
            this.receiver.removeAllListeners();
            this.voice.destroy();
        } catch {
            /* noop */
        }
    }

    public static createConnection(channel: VoiceChannels, manager: DartVoiceManager, options?: VoiceJoinConfig): Promise<VoiceConnection> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const [error, connection] = await catchError(() => VoiceConnection.joinChannel(channel, options));
            if (error) return reject(error);
            const vc = new VoiceConnection(connection, {
                channel,
                manager
            });
            resolve(vc);
        });
    }

    public static joinChannel(channel: VoiceChannels, options?: VoiceJoinConfig): Promise<VoiceConnectionNative> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const rawConnection = joinVoiceChannel({
                guildId: channel.guild.id,
                channelId: channel.id,
                adapterCreator: channel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
                selfDeaf: !!options?.selfDeaf,
                selfMute: !!options?.selfMute,
                group: options?.group
            });

            const [error, connection] = await catchError(() => {
                return entersState(rawConnection, VoiceConnectionStatus.Ready, 30_000);
            });
            if (error) return reject(error);
            resolve(connection);
        });
    }

    public play(stream: Readable | string, options?: PlayOptions) {
        if (!this.dispatcher) {
            const dispatcher = new StreamDispatcher(this);
            this.dispatcher = dispatcher;
        }
        this.dispatcher.playStream(stream, options);
        return this.dispatcher;
    }

    public get status() {
        return this.voice.state.status;
    }

    public get ping() {
        const latency = this.voice.ping.udp;

        return typeof latency !== "number" ? NaN : latency;
    }
}

export { VoiceConnection };

import { joinVoiceChannel, entersState, VoiceConnectionStatus, VoiceConnection as VoiceConnectionNative, DiscordGatewayAdapterCreator, NoSubscriberBehavior } from "@discordjs/voice";
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

    /**
     * The audio player
     */
    public get audioPlayer() {
        return this.dispatcher?.audioPlayer;
    }

    /**
     * Disconnect from this connection
     */
    public disconnect() {
        try {
            this.dispatcher.removeAllListeners();
            this.receiver.removeAllListeners();
            this.voice.disconnect();
        } catch {
            /* noop */
        }
    }

    /**
     * Destroy this connection
     */
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

    /**
     * Create a voice connection
     * @param channel The voice channel
     * @param manager The voice manager
     * @param options Join config
     */
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

    /**
     * Join a voice channel
     * @param channel The voice channel
     * @param options The join config
     */
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

    /**
     * Play readable stream or remote stream source in this connection
     * @param stream The stream source
     * @param options The play options
     */
    public play<T = unknown>(
        stream: Readable | string,
        options?: PlayOptions<T> & {
            behaviours?: {
                noSubscriber?: NoSubscriberBehavior;
                maxMissedFrames?: number;
            };
        }
    ) {
        if (!this.dispatcher) {
            const dispatcher = new StreamDispatcher(
                this,
                options?.behaviours
                    ? {
                          behaviors: options.behaviours
                      }
                    : {}
            );
            this.dispatcher = dispatcher;
        }
        this.dispatcher.playStream(stream, options);
        return this.dispatcher as StreamDispatcher<T>;
    }

    /**
     * The voice connection status
     */
    public get status() {
        return this.voice.state.status;
    }

    /**
     * The voice connection latency (udp)
     */
    public get ping() {
        const latency = this.voice.ping.udp;

        return typeof latency !== "number" ? NaN : latency;
    }
}

export { VoiceConnection };

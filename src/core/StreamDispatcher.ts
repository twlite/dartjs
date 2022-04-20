import { createAudioResource, createAudioPlayer, AudioResource, StreamType, AudioPlayerStatus, VoiceConnectionStatus, VoiceConnectionDisconnectReason, entersState, CreateAudioPlayerOptions } from "@discordjs/voice";
import type { Readable } from "stream";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { VolumeTransformer } from "../smoothVolume/VolumeTransformer";
import { DispatcherEvents, PlayOptions } from "../types/types";
import { randomId, wait } from "../Utils/Util";
import VoiceConnection from "./VoiceConnection";

export interface ArMetadata<T = unknown> {
    nonce: string;
    data: T;
}

export default class StreamDispatcher<T = unknown> extends EventEmitter<DispatcherEvents<T>> {
    public audioPlayer = createAudioPlayer(this.audioPlayerOptions || {});
    public audioResource: AudioResource<ArMetadata<T>> = null;
    private _readyLock = false;
    private _ignoreList = new Set<string>();
    private _nextTickCallbacks = new Array<() => unknown>();
    private _immediateCallbacks = new Array<() => unknown>();

    public constructor(public readonly connection: VoiceConnection, public audioPlayerOptions: CreateAudioPlayerOptions = {}) {
        super();
        this.attachEvents();
        this.connection.voice.subscribe(this.audioPlayer);
    }

    public cleanUp() {
        this.connection.voice.removeAllListeners("stateChange");
        this.connection.voice.removeAllListeners("debug");
        this.connection.voice.removeAllListeners("error");
        this.audioPlayer.removeAllListeners("stateChange");
        this.audioPlayer.removeAllListeners("error");
    }

    private attachEvents() {
        if (!this.connection.voice.eventNames().includes("stateChange"))
            // @ts-expect-error Argument of type '"stateChange"' is not assignable to parameter of type 'VoiceConnectionStatus.Signalling'?
            this.connection.voice.on("stateChange", async (_, newState) => {
                if (newState.status === VoiceConnectionStatus.Disconnected) {
                    if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                        try {
                            await entersState(this.connection.voice, VoiceConnectionStatus.Connecting, 5_000);
                        } catch {
                            this.connection.voiceManager.connections.delete(this.connection.channel.guildId);
                            this.connection.emit("disconnect");
                            this.connection.voice.destroy();
                        }
                    } else if (this.connection.voice.rejoinAttempts < 5) {
                        await wait((this.connection.voice.rejoinAttempts + 1) * 5_000);
                        this.connection.voice.rejoin();
                    } else {
                        this.connection.voiceManager.connections.delete(this.connection.channel.guildId);
                        this.connection.emit("disconnect");
                        this.connection.voice.destroy();
                    }
                } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                    this.audioPlayer?.stop();
                } else if (!this._readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)) {
                    this._readyLock = true;
                    try {
                        await entersState(this.connection.voice, VoiceConnectionStatus.Ready, 20_000);
                    } catch {
                        if (this.connection.voice.state.status !== VoiceConnectionStatus.Destroyed) this.connection.voice.destroy();
                        this.connection.voiceManager.connections.delete(this.connection.channel.guildId);
                        this.connection.emit("disconnect");
                    } finally {
                        this._readyLock = false;
                    }
                }
            });

        if (!this.audioPlayer.eventNames().includes("stateChange"))
            // @ts-expect-error Argument of type '"stateChange"' is not assignable to parameter of type 'AudioPlayerStatus.Idle'?
            this.audioPlayer.on("stateChange", (oldState, newState) => {
                if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                    this._immediateCall();
                    const nonce = this.audioResource?.metadata?.nonce;
                    if (typeof nonce === "string" && this._ignoreList.has(nonce)) return this._ignoreList.delete(nonce);
                    this.emit("finish", this.audioResource?.metadata as ArMetadata<T>);
                } else if (newState.status === AudioPlayerStatus.Playing && oldState.status === AudioPlayerStatus.Buffering) {
                    this._nextTickCall();
                    const nonce = this.audioResource?.metadata?.nonce;
                    if (this._ignoreList.has(nonce)) return this._ignoreList.delete(nonce);
                    // emit the event
                    this.emit("start", this.audioResource?.metadata as ArMetadata<T>);
                }
            });

        if (!this.connection.voice.eventNames().includes("debug")) this.connection.voice.on("debug", (m) => void this.connection.emit("debug", m));
        if (!this.connection.voice.eventNames().includes("error")) this.connection.voice.on("error", (error) => void this.connection.emit("error", error));
        if (!this.audioPlayer.eventNames().includes("debug")) this.audioPlayer.on("debug", (m) => void this.emit("debug", m));
        if (!this.audioPlayer.eventNames().includes("error")) this.audioPlayer.on("error", (error) => void this.emit("error", error));
    }

    /**
     * Stop the player
     * @param [force=false] If the playback should be forcefully stopped
     */
    public end(force = false) {
        this.audioPlayer.stop(force);
    }

    /**
     * Stop the player
     * @param [force=false] If the playback should be forcefully stopped
     */
    public stop(force = false) {
        this.end(force);
    }

    /**
     * Play stream over voice connection
     * @param stream The readable stream or stream source url to play
     * @param options Play options
     */
    public playStream(stream: Readable | string, options?: PlayOptions<T>) {
        const audioResource = createAudioResource(stream, {
            inputType:
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                {
                    // discord.js v12 types
                    converted: StreamType.Raw,
                    unknown: StreamType.Arbitrary
                }[options?.type as StreamType] ||
                (options?.type as StreamType) ||
                StreamType.Arbitrary,
            inlineVolume: options?.inlineVolume ?? true,
            silencePaddingFrames: typeof options?.silencePaddingFrames !== "number" ? 5 : options?.silencePaddingFrames,
            metadata: Object.defineProperties(
                {},
                {
                    nonce: {
                        value: randomId(),
                        enumerable: true,
                        writable: false,
                        configurable: false
                    },
                    data: {
                        value: options?.metadata,
                        writable: true,
                        enumerable: true,
                        configurable: true
                    }
                }
            ) as ArMetadata<T>
        });

        if (typeof options?.initialVolume === "number" && audioResource.volume) {
            Reflect.set(audioResource.volume, "volume", options.initialVolume);
        }

        if (typeof options?.volumeSmoothness === "number" && audioResource.volume && (audioResource.volume as VolumeTransformer).hasSmoothness) {
            Reflect.set(audioResource.volume, "_smoothing", options.volumeSmoothness || 0);
        }

        if (options?.ignorePrevious && this.audioResource?.metadata?.nonce) this._ignoreList.add(this.audioResource.metadata.nonce);
        this.end(true);
        this.audioResource = audioResource;
        this.audioPlayer.play(audioResource);
    }

    /**
     * Set volume
     * @param amount The volume amount to set
     */
    public setVolume(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolume(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    /**
     * Set volume in percentage
     * @param amount The volume amount to set
     */
    public setVolumePercentage(percentage: number) {
        const lastVolume = this.volumePercentage;
        if (lastVolume === percentage || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolume(percentage / 100);
        this.emit("volumeChange", lastVolume / 100, this.volume);
        return true;
    }

    /**
     * Set volume in logarithmic value
     * @param amount The volume to set
     */
    public setVolumeLogarithmic(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolumeLogarithmic(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    /**
     * Set volume in decibels
     * @param amount The volume in decibels
     */
    public setVolumeDecibels(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolumeDecibels(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    /**
     * Get current volume amount
     */
    public get volume() {
        return this.audioResource?.volume?.volume ?? 1;
    }

    /**
     * Get current volume in percentage
     */
    public get volumePercentage() {
        return this.volume * 100;
    }

    /**
     * Get current volume as decibels
     */
    public get volumeDecibels() {
        return this.audioResource?.volume?.volumeDecibels ?? 1;
    }

    /**
     * Get current volume as logarithmic value
     */
    public get volumeLogarithmic() {
        return this.audioResource?.volume?.volumeLogarithmic ?? 1;
    }

    /**
     * Check if the volume is editable
     */
    public get volumeEditable() {
        return Boolean(this.audioResource?.volume);
    }

    /**
     * Volume smoothness availability
     */
    public get volumeSmoothnessEditable() {
        return !!(this.audioResource.volume as VolumeTransformer)?.hasSmoothness;
    }

    /**
     * Set volume smoothness
     * @param smoothness
     */
    public setVolumeSmoothness(smoothness: number) {
        if (!this.volumeSmoothnessEditable) return false;
        Reflect.set(this.audioResource.volume, "_smoothing", smoothness);
        return true;
    }

    /**
     * Get volume smoothness
     */
    public get volumeSmoothness() {
        return (this.audioResource.volume as VolumeTransformer)?.smoothness || 0;
    }

    /**
     * The actual streamed duration in ms of current audio resource
     */
    public get streamTime() {
        return this.audioResource?.playbackDuration ?? 0;
    }

    /**
     * The total streamed duration in ms of the current audio resource, including paused states
     */
    public get totalStreamTime() {
        return this.audioPlayer?.state.status === AudioPlayerStatus.Playing ? this.audioPlayer?.state.playbackDuration : 0;
    }

    /**
     * The paused state
     */
    public get paused() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Paused || this.audioPlayer.state.status === AudioPlayerStatus.AutoPaused;
    }

    /**
     * Pause the player
     * @param silence Send silence frame during paused state
     */
    public pause(silence = false) {
        this.audioPlayer?.pause(silence);
    }

    /**
     * Resumes the player
     */
    public resume() {
        this.audioPlayer?.unpause();
    }

    /**
     * Callback provided here runs whenever next track is playable
     * @param cb The callback function
     */
    public next(cb: () => unknown) {
        if (!cb || typeof cb !== "function") throw new TypeError("Next tick callback must be a function");
        this._nextTickCallbacks.push(cb);
    }

    /**
     * Callback provided here runs whenever next track is playable
     * @param cb The callback function
     */
    public immediate(cb: () => unknown) {
        if (!cb || typeof cb !== "function") throw new TypeError("Next tick callback must be a function");
        this._immediateCallbacks.push(cb);
    }

    private _immediateCall() {
        if (!this._immediateCallbacks.length) return;
        this._immediateCallbacks.forEach((cb, idx) => {
            void this._immediateCallbacks.splice(idx, 1);
            cb();
        });
    }

    private _nextTickCall() {
        if (!this._nextTickCallbacks.length) return;
        this._nextTickCallbacks.forEach((cb, idx) => {
            void this._nextTickCallbacks.splice(idx, 1);
            cb();
        });
    }
}

export { StreamDispatcher };

import { createAudioResource, createAudioPlayer, AudioResource, StreamType, AudioPlayerStatus, VoiceConnectionStatus, VoiceConnectionDisconnectReason, entersState } from "@discordjs/voice";
import type { Readable } from "stream";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { DispatcherEvents, PlayOptions } from "../types/types";
import { wait } from "../Utils/Util";
import VoiceConnection from "./VoiceConnection";

export default class StreamDispatcher extends EventEmitter<DispatcherEvents> {
    public audioPlayer = createAudioPlayer();
    public audioResource: AudioResource = null;
    private readyLock = false;

    public constructor(public readonly connection: VoiceConnection) {
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
                } else if (!this.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)) {
                    this.readyLock = true;
                    try {
                        await entersState(this.connection.voice, VoiceConnectionStatus.Ready, 20_000);
                    } catch {
                        if (this.connection.voice.state.status !== VoiceConnectionStatus.Destroyed) this.connection.voice.destroy();
                        this.connection.voiceManager.connections.delete(this.connection.channel.guildId);
                        this.connection.emit("disconnect");
                    } finally {
                        this.readyLock = false;
                    }
                }
            });

        if (!this.audioPlayer.eventNames().includes("stateChange"))
            this.audioPlayer.on("stateChange", (oldState, newState) => {
                if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                    this.emit("finish");
                } else if (newState.status === AudioPlayerStatus.Playing && oldState.status === AudioPlayerStatus.Buffering) {
                    this.emit("start");
                }
            });

        if (!this.connection.voice.eventNames().includes("debug")) this.connection.voice.on("debug", (m) => void this.connection.emit("debug", m));
        if (!this.connection.voice.eventNames().includes("error")) this.connection.voice.on("error", (error) => void this.connection.emit("error", error));
        if (!this.audioPlayer.eventNames().includes("debug")) this.audioPlayer.on("debug", (m) => void this.emit("debug", m));
        if (!this.audioPlayer.eventNames().includes("error")) this.audioPlayer.on("error", (error) => void this.emit("error", error));
    }

    public end(force = false) {
        this.audioPlayer.stop(force);
    }

    public stop(force = false) {
        this.end(force);
    }

    public playStream(stream: Readable | string, options?: PlayOptions) {
        this.audioResource = createAudioResource(stream, {
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
            inlineVolume: options?.inlineVolume ?? true
        });

        this.end(true);
        this.audioPlayer.play(this.audioResource);
    }

    public setVolume(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolume(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    public setVolumeLogarithmic(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolumeLogarithmic(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    public setVolumeDecibels(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolumeDecibels(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    public get volume() {
        return this.audioResource?.volume?.volume ?? 1;
    }

    public get volumeDecibels() {
        return this.audioResource?.volume?.volumeDecibels ?? 1;
    }

    public get volumeLogarithmic() {
        return this.audioResource?.volume?.volumeLogarithmic ?? 1;
    }

    public get volumeEditable() {
        return Boolean(this.audioResource?.volume);
    }

    public get streamTime() {
        return this.audioResource?.playbackDuration ?? 0;
    }

    public get totalStreamTime() {
        return this.audioPlayer?.state.status === AudioPlayerStatus.Playing ? this.audioPlayer?.state.playbackDuration : 0;
    }

    public get paused() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Paused || this.audioPlayer.state.status === AudioPlayerStatus.AutoPaused;
    }

    public pause(silence = false) {
        this.audioPlayer?.pause(silence);
    }

    public resume() {
        this.audioPlayer?.unpause();
    }
}

export { StreamDispatcher };

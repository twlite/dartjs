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

    constructor(public readonly connection: VoiceConnection) {
        super();
        this.attachEvents();
        this.connection.voice.subscribe(this.audioPlayer);
    }

    private attachEvents() {
        this.connection.voice.on("stateChange", async (_, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    try {
                        await entersState(this.connection.voice, VoiceConnectionStatus.Connecting, 5_000);
                    } catch {
                        this.connection.manager.connections.delete(this.connection.channel.guildId);
                        this.connection.emit("disconnect");
                        this.connection.voice.destroy();
                    }
                } else if (this.connection.voice.rejoinAttempts < 5) {
                    await wait((this.connection.voice.rejoinAttempts + 1) * 5_000);
                    this.connection.voice.rejoin();
                } else {
                    this.connection.manager.connections.delete(this.connection.channel.guildId);
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
                    this.connection.manager.connections.delete(this.connection.channel.guildId);
                    this.connection.emit("disconnect");
                } finally {
                    this.readyLock = false;
                }
            }
        });

        this.audioPlayer.on("stateChange", (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                this.emit("finish");
            } else if (newState.status === AudioPlayerStatus.Playing) {
                this.emit("start");
            }
        });

        this.audioPlayer.on("debug", (m) => void this.emit("debug", m));
        this.audioPlayer.on("error", (error) => void this.emit("error", error));
    }

    playStream(stream: Readable | string, options?: PlayOptions) {
        this.audioResource = createAudioResource(stream, {
            inputType: (options?.type as StreamType) || StreamType.Arbitrary,
            inlineVolume: options?.inlineVolume ?? true
        });

        this.audioPlayer.play(this.audioResource);
    }

    setVolume(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolume(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    setVolumeLogarithmic(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolumeLogarithmic(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    setVolumeDecibels(amount: number) {
        const lastVolume = this.volume;
        if (lastVolume === amount || !this.audioResource?.volume) return false;
        this.audioResource?.volume?.setVolumeDecibels(amount);
        this.emit("volumeChange", lastVolume, this.volume);
        return true;
    }

    get volume() {
        return this.audioResource?.volume?.volume ?? 1;
    }

    get volumeDecibels() {
        return this.audioResource?.volume?.volumeDecibels ?? 1;
    }

    get volumeLogarithmic() {
        return this.audioResource?.volume?.volumeLogarithmic ?? 1;
    }

    get volumeEditable() {
        return Boolean(this.audioResource?.volume);
    }

    get streamTime() {
        return this.audioResource?.playbackDuration ?? 0;
    }

    get totalStreamTime() {
        return this.audioPlayer?.state.status === AudioPlayerStatus.Playing ? this.audioPlayer?.state.playbackDuration : 0;
    }

    get paused() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Paused || this.audioPlayer.state.status === AudioPlayerStatus.AutoPaused;
    }

    pause(silence = false) {
        this.audioPlayer?.pause(silence);
    }

    resume() {
        this.audioPlayer?.unpause();
    }
}

export { StreamDispatcher };

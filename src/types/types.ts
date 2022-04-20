import { JoinConfig, StreamType } from "@discordjs/voice";
import type { VoiceChannel, StageChannel } from "discord.js";
import type { DartVoiceManager } from "../core/DartVoiceManager";

export type VoiceChannels = VoiceChannel | StageChannel;

export interface VoiceEvents {
    debug: (message: string) => void;
    error: (error: Error) => void;
    disconnect: () => void;
}

export interface VoiceReceiverEvents {
    debug: (message: string) => void;
}

export interface DispatcherEvents<T = unknown> {
    start: (metadata?: { nonce?: string; data?: T }) => void;
    finish: (metadata?: { nonce?: string; data?: T }) => void;
    error: (error: Error) => void;
    debug: (message: string) => void;
    volumeChange: (oldVolume: number, newVolume: number) => void;
}

export interface VoiceConnectionData {
    channel: VoiceChannels;
    manager: DartVoiceManager;
}

export interface PlayOptions<T = unknown> {
    /** The stream type */
    type?: `${StreamType}` | StreamType | "converted" | "unknown";
    /** Enable/disable on-the-fly volume controls */
    inlineVolume?: boolean;
    /** Silence padding frames */
    silencePaddingFrames?: number;
    /** Initial volume */
    initialVolume?: number;
    /** Volume smoothness */
    volumeSmoothness?: number;
    /** Track metadata */
    metadata?: T;
    /** Ignore previous track event on running `<Dispatcher>.play()` */
    ignorePrevious?: boolean;
}

export interface ReceiveStreamOptions {
    mode?: "opus" | "pcm";
    end?: "silence" | "manual";
}

export type VoiceJoinConfig = Omit<JoinConfig, "channelId" | "guildId">;

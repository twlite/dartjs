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

export interface DispatcherEvents {
    start: () => void;
    finish: () => void;
    error: (error: Error) => void;
    debug: (message: string) => void;
    volumeChange: (oldVolume: number, newVolume: number) => void;
}

export interface VoiceConnectionData {
    channel: VoiceChannels;
    manager: DartVoiceManager;
}

export interface PlayOptions {
    type?: `${StreamType}` | StreamType;
    inlineVolume?: boolean;
}

export interface ReceiveStreamOptions {
    mode?: "opus" | "pcm";
    end?: "silence" | "manual";
}

export type VoiceJoinConfig = Omit<JoinConfig, "channelId" | "guildId">;

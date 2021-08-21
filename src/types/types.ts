import { StreamType } from "@discordjs/voice";
import type { VoiceChannel, StageChannel } from "discord.js";
import type { DartVoiceManager } from "../core/DartVoiceManager";

export type VoiceChannels = VoiceChannel | StageChannel;

export interface VoiceEvents {
    debug: (message: string) => void;
    error: (error: Error) => void;
    disconnect: () => void;
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
    type?: `${StreamType}`;
    inlineVolume?: boolean;
}

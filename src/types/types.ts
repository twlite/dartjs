import type { VoiceChannel, StageChannel } from "discord.js";

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
}

import type { Client, Snowflake, GuildVoiceChannelResolvable, VoiceBasedChannelTypes } from "discord.js";
import { Collection } from "discord.js";
import VoiceConnection from "./VoiceConnection";
import { VoiceChannels, VoiceJoinConfig } from "../types/types";

export default class DartVoiceManager {
    public connections = new Collection<Snowflake, VoiceConnection>();
    public constructor(public readonly client: Client) {}

    /**
     * Join a voice channel
     * @param channel The voice based channel
     * @param options Join config
     */
    public async join(channel: GuildVoiceChannelResolvable, options?: VoiceJoinConfig) {
        const vc = this.client.channels.resolve(channel ?? "");
        if (!vc || !vc.isVoice()) throw new Error("Voice channel was not provided!");

        if (!(["GUILD_STAGE_VOICE", "GUILD_VOICE"] as VoiceBasedChannelTypes[]).includes(vc.type)) {
            throw new TypeError("Cannot join non-voice channel");
        }

        if (this.connections.has(vc.guildId)) {
            return await this.updateChannel(this.connections.get(vc.guildId), vc);
        } else {
            const connection = await VoiceConnection.createConnection(vc, this, options);
            this.connections.set(vc.guildId, connection);

            return connection;
        }
    }

    /**
     * Leave a voice channel
     * @param channel The voice channel
     */
    public leave(channel: GuildVoiceChannelResolvable) {
        const vc = this.client.channels.resolve(channel ?? "");
        if (!vc || !vc.isVoice()) throw new Error("Voice channel was not provided!");

        if (!(["GUILD_STAGE_VOICE", "GUILD_VOICE"] as VoiceBasedChannelTypes[]).includes(vc.type)) {
            throw new TypeError("Cannot leave non-voice channel");
        }

        if (!this.connections.has(vc.guildId)) return;

        const connection = this.connections.get(vc.guildId);
        connection.disconnect();
        connection.destroy();
        this.connections.delete(vc.guildId);
    }

    /**
     * Update voice connection
     * @param connection The voice connection
     * @param channel The new voice channel
     */
    public async updateChannel(connection: VoiceConnection, channel: VoiceChannels) {
        const vc = await VoiceConnection.joinChannel(channel);
        connection.voice = vc;
        connection.options.channel = channel;

        this.connections.set(connection.channel.guildId, connection);

        return connection;
    }
}

export { DartVoiceManager };

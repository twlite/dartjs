import type { Client, Snowflake, GuildVoiceChannelResolvable, VoiceBasedChannelTypes } from "discord.js";
import { Collection } from "discord.js";
import VoiceConnection from "./VoiceConnection";
import { VoiceChannels } from "../types/types";

export default class DartVoiceManager {
    public connections = new Collection<Snowflake, VoiceConnection>();
    public constructor(public readonly client: Client) {}

    public async join(channel: GuildVoiceChannelResolvable) {
        const vc = this.client.channels.resolve(channel ?? "");
        if (!vc || !vc.isVoice()) throw new Error("Voice channel was not provided!");

        if (!(["GUILD_STAGE_VOICE", "GUILD_VOICE"] as VoiceBasedChannelTypes[]).includes(vc.type)) {
            throw new TypeError("Cannot join non-voice channel");
        }

        if (this.connections.has(vc.guildId)) {
            if (this.connections.get(vc.guildId).channel.id !== vc.id) {
                return await this.updateChannel(this.connections.get(vc.guildId), vc);
            } else {
                const connection = this.connections.get(vc.guildId);
                return connection;
            }
        } else {
            const connection = await VoiceConnection.createConnection(vc);
            this.connections.set(vc.guildId, connection);

            return connection;
        }
    }

    public async updateChannel(connection: VoiceConnection, channel: VoiceChannels) {
        const vc = await VoiceConnection.joinChannel(channel);
        connection.voice = vc;
        connection.options.channel = channel;

        this.connections.set(connection.channel.guildId, connection);

        return connection;
    }
}

export { DartVoiceManager };

# DartJS

DartJS is a Discord.js voice framework that aims to provide similar voice interface of Discord.js v12.

# Installation

```sh
$ npm i --save dartjs
```

> You may need to install encryption library and opus engine as well.

# Features

* supports voice receiving
* supports voice sending
* close to discord.js v12 voice api
* injects nothing to your client or discord.js

# Note

Use `<Dispatcher>.once` instead of `<Dispatcher>.on`. Since the concept of `StreamDispatcher` is gone with the [voice rewrite](https://npmjs.com/package/@discordjs/voice), the StreamDispatcher polyfill does not work exactly like discord.js v12 voice. Using `.on` to handle events may cause the dispatcher to trigger the event multiple times since same dispatcher instance is used throughout the session. Using `.once` to handle events will only trigger the event once per your music bot session and wont break your code since `.once` removes the listener immediately after the event is emitted.

# Example

## Music Bot

```js
const Discord = require("discord.js");
const client = new Discord.Client({
    intents: [
        Discord.Intents.GUILDS,
        Discord.Intents.GUILD_VOICE_STATES,
        Discord.Intents.GUILD_MESSAGES
    ]
});
const { DartVoiceManager } = require("dartjs");
const voiceManager = new DartVoiceManager(client);
const ytdl = require("ytdl-core");

client.on("ready", () => console.log("Bot is online!"));

client.on("messageCreate", message => {
    if (message.author.bot) return;

    if (message.content === "!play") {
        voiceManager.join(message.member.voice.channel)
            .then(connection => {
            const dispatcher = connection.play(ytdl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
            dispatcher.once("start", () => message.channel.send("Music started!"));
            dispatcher.once("finish", () => {
                message.channel.send("Music finished!");
            });
        });
    }
});

client.login("XXX");
```

## Voice Receiving

```js
const Discord = require("discord.js");
const client = new Discord.Client({
    intents: [
        Discord.Intents.GUILDS,
        Discord.Intents.GUILD_VOICE_STATES,
        Discord.Intents.GUILD_MESSAGES,
        Discord.Intents.GUILD_MEMBERS
    ]
});
const { DartVoiceManager } = require("dartjs");
const voiceManager = new DartVoiceManager(client);
const fs = require("fs");

client.on("ready", () => console.log("Bot is online!"));

client.on("messageCreate", message => {
    if (message.author.bot) return;

    if (message.content === "!record") {
        voiceManager.join(message.member.voice.channel)
            .then(connection => {
                const receiver = connection.receiver.createStream(message.member, {
                    mode: "pcm",
                    end: "silence"
                });

                const writer = receiver.pipe(fs.createWriteStream("./recorded.pcm"));

                writer.on("finish", () => {
                    message.channel.send("Finished recording!");
                });
            });
    }
});

client.login("XXX");
```

> See **[https://github.com/discord-player/voice-recorder-example](https://github.com/discord-player/voice-recorder-example)** for a complete voice recorder example.

### Smooth Volume

This feature enables smooth volume transition.

> This library will attempt to polyfill smooth volume api by default. This can be disabled by setting `DARTJS_DISABLE_INJECTION` in env.

**Example:**

```js
// injecting manually
require("dartjs").injectSmoothVolume();

// Set smoothness before playing
dispatcher.play(stream, {
    // use whatever value feels better
    volumeSmoothness: 0.08
});

// setting smoothness on-the-fly
dispatcher.setVolumeSmoothness(0.08)
```
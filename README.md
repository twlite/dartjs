# DartJS

DartJS is a Discord.js voice framework that aims to provide similar voice interface of Discord.js v12.

# Installation

```sh
$ npm i --save dartjs
```

> You may need to install encryption library and opus engine as well.

# Note

* Use `<Dispatcher>.once` instead of `<Dispatcher>.on`

> This library was created just for learning purpose and a personal music bot. You don't have to use this
unless you really want to.

# Example

```js
const Discord = require("discord.js");
const client = new Discord.Client({
  	intents: [Discord.Intents.GUILDS, Discord.Intents.GUILD_VOICE_STATES, Discord.Intents.GUILD_MESSAGES]
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
						connection.disconnect();
						message.channel.send("Music finished!");
					});
			});
	}
});

client.login("XXX");
```
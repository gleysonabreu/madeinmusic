import Discord, { Message } from "discord.js";
import ytdl from "ytdl-core";
import dotenv from 'dotenv';
import { searchYoutube } from "./youtube";
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', '.env')
});

type Song = {
  title: string;
  url: string;
}
type Queue = {
  textChannel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
  voiceChannel: Discord.VoiceChannel;
  connection: Discord.VoiceConnection | null;
  songs: Song[];
  volume: number;
  playing: boolean;
}

const client = new Discord.Client();
const queue = new Map<string, Queue>();

client.once("ready", () => {
  console.log(`${process.env.BOT_NAME} ready!`);
});

client.once("reconnecting", () => {
  console.log(`${process.env.BOT_NAME} reconnecting..`);
});

client.once("disconnect", () => {
  console.log(`${process.env.BOT_NAME} disconnected!`);
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(`${process.env.COMMAND_SYMBOL}`)) return;

  if (!message.guild) return;

  const serverQueue = queue.get(message.guild.id);
  if (message.content.startsWith(`${process.env.COMMAND_SYMBOL}play`)) {
    execute(message, serverQueue);
    return;
  } else if(message.content.startsWith(`${process.env.COMMAND_SYMBOL}stop`)){
    stop(message, serverQueue);
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
    return;
  }
});

async function stop(message: Message, serverQueue: any) {
  const voiceChannel = message.member?.voice.channel;
  if(!voiceChannel) {
    return message.channel.send("You have to be in a voice channel to stop the music!");   
  }

  if(!serverQueue) {
    return message.channel.send("There is no song that I could stop!");
  }

  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

async function execute(message: Message, serverQueue: Queue | undefined) {
  const args = message.content.split(" ");

  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel)
    return message.channel.send("You need to be in a voice channel to play music!");

	const user = message.client.user;
	if (!user) return;

  const permissions = voiceChannel.permissionsFor(user);
  if (!permissions?.has("CONNECT") || !permissions?.has("SPEAK")) {
    return message.channel.send("I need the permissions to join and speak in your voice channel!");
  }

  const verifySameChannelVoice = queue.get(message.guild?.id as string);
  if(verifySameChannelVoice && message?.member?.voice?.channel?.id !== verifySameChannelVoice?.voiceChannel.id) {
    return message.channel.send("You must be on the same channel as the bot to add songs!");
  }
  

  const result = await searchYoutube(args);
  const songInfo = await ytdl.getInfo(result.data.items[0].id.videoId);
  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
   };

  if (!serverQueue) {
    const queueConstruct: Queue = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      songs: [],
      volume: 5,
      playing: true,
      connection: null,
    };

    if(!message.guild) return;

    queue.set(message.guild.id, queueConstruct);
    queueConstruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueConstruct.connection = connection;
      play(message.guild, queueConstruct.songs[0]);
      queueConstruct.connection.on("disconnect", () => {
        if(!message.guild) return;

        queue.delete(message.guild.id);
      });
    } catch (err: any) {
      console.log(err);
      queue.delete(message.guild?.id);
      return message.channel.send(err);
    }
  } else {
    if(!message.guild) return;

    const musics = queue.get(message.guild.id);
    if(musics) {
      musics.songs.push(song)
      return message.channel.send(`**${song.title}** has been added to the queue!`);
    }
  }
}

function play(guild: Discord.Guild, song: Song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    if(serverQueue) {
      serverQueue.voiceChannel.leave();
      queue.delete(guild?.id);
    }
    return;
  }

  if (serverQueue && serverQueue.connection) {
    const dispatcher = serverQueue.connection
    .play(ytdl(song.url, { filter: 'audioonly', highWaterMark: 1048576 / 4, }))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", (error: any) => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
  }
}

client.login(process.env.BOT_TOKEN);
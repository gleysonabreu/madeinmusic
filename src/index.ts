import Discord, { Message } from "discord.js";
import ytdl from "ytdl-core";
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const client = new Discord.Client();
const queue = new Map();

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

  const serverQueue = queue.get(message.guild?.id);

  if (message.content.startsWith(`${process.env.COMMAND_SYMBOL}play`)) {
    execute(message, serverQueue);
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

async function execute(message: Message, serverQueue: Map<any, any>) {
  const args = message.content.split(" ");

  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );

		const user = message.client.user;
		if (!user) return;

  const permissions = voiceChannel.permissionsFor(user);
  if (!permissions?.has("CONNECT") || !permissions?.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  type YT = {
    data: {
      items: {id: { videoId: string }}[],
    }
  }

  let musicName = '';
  args.map((music, index) => {
    if( index === 0 ) return;

    musicName += ` ${music}`;
  });

  const result = (await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${musicName}&type=video&key=${process.env.YOUTUBE_API}`)) as YT;
  const songInfo = await ytdl.getInfo( result.data?.items[0].id.videoId);
  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
   };

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null as any,
      songs: [] as any[],
      volume: 5,
      playing: true
    };

    queue.set(message.guild?.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err: any) {
      console.log(err);
      queue.delete(message.guild?.id);
      return message.channel.send(err);
    }
  } else {
    const musics = queue.get(message.guild?.id);
    musics.songs.push(song)
    return message.channel.send(`**${song.title}** has been added to the queue!`);
  }
}

function play(guild: Discord.Guild | null, song: any) {
  const serverQueue = queue.get(guild?.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild?.id);
    return;
  }

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

client.login(process.env.BOT_TOKEN);
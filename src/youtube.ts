import axios from "axios";

type YT = {
  data: {
    items: {id: { videoId: string }}[],
  }
}

async function searchYoutube(music_name: string[]) {
  let musicName = '';
  music_name.map((music, index) => {
    if( index === 0 ) return;

    musicName += ` ${music}`;
  });

  const result = (await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${musicName}&type=video&key=${process.env.YOUTUBE_API}`)) as YT;
  return result;
}

export { searchYoutube };
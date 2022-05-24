import puppeteer from 'puppeteer';
import { env } from './config/env';

async function crawler(music_name: string[]) {
  let musicName = '';
  music_name.map((music, index) => {
    if( index === 0 ) return;

    musicName += ` ${music}`;
  });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`${env.urlYoutube}/results?search_query=${musicName}`, {
    waitUntil: 'networkidle2',
  });

  const [urlVideo] = await page.evaluate(() => {
    const videos = document.querySelectorAll('#video-title');
    const firstVideo = videos[0];
    const urlVideo = firstVideo.getAttribute('href');
  
    return [urlVideo];
  });
  await browser.close();

  const url = `${env.urlYoutube}${urlVideo}`;
  return url;
}

export { crawler };


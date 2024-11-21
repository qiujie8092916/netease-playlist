const fs = require('fs');
const cron = require('node-cron');
const path = require('path');

require('dotenv').config();

const retry_count = isNaN(Number(process.env.RETRY_COUNT)) ? 10 : Number(process.env.RETRY_COUNT);
const cronExpression = process.env.CRON || '0 0 * * *';
const playlistID = process.env.PLAYLIST_ID || '';
const immediately = process.env.IMMEDIATELY || 'false';
const cookie = process.env.COOKIE || '';
const exportPath = '/usr/src/app/music_list';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const main = async () => {
  if (!playlistID) {
    throw `Can not get playlistID of ${playlistID}`
  }

  for (let count = 1; count <= retry_count; count++) {
    console.log(`[${count}/${retry_count}]: starting...`);
    try {
      await task();
      break;
    } catch (e) {
      console.error('prepare sleep 1s: ', e)
      await sleep(1000);
    }
  }
}

const task = async () => {
  fetch(`https://music.163.com/api/playlist/detail?id=${playlistID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    }
  }).then(async response => {
    const json = await response.json();

    if (json.code !== 200) {
      console.error(`【${json.code}】requst failed: ${json.msg}`);
      return Promise.reject(json.msg);
    }

    console.log('tracks.length: ', json?.result?.tracks.length)

    const xiaomusic_music_list_json = [
      {
        name: json.result.name,
        musics: (json?.result?.tracks ?? []).map(track => ({
          name: track.name,
          url: `http://music.163.com/song/media/outer/url?id=${track.id}.mp3`
        }))
      }
    ];

    if (fs.existsSync(path)) {
        console.log(`folder 【${exportPath}】 exsit`);
    } else {
      console.log(`folder 【${exportPath}】 not exsit, creating`);

      try {
        fs.mkdirSync(exportPath, { recursive: true });
        console.log(`folder 【${exportPath}】 create success`);
      } catch (err) {
        throw `create folder failed:, ${err}`
      }

      try {
        fs.writeFileSync(path.join(exportPath, 'xiaomusic_music_list.json'), JSON.stringify(xiaomusic_music_list_json), 'utf-8');
        console.log('write file sucsess!');
      } catch (err) {
          console.error('write file failed: ', err);
      }
    }

    return Promise.resolve();
  }).catch((err) => {
    console.error(`requst failed: ${err}`);
    return Promise.reject(err);
  });
}

if (immediately === 'true') {
  main();
}

cron.schedule(cronExpression, main);

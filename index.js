const fs = require('fs');
const cron = require('node-cron');
const path = require('path');

require('dotenv').config();

const cronExpression = process.env.CRON || '0 0 * * *';
const playlistID = process.env.PLAYLIST_ID || '';
const exportPath = '/usr/src/app/music_list'
const main = () => {
  if(!playlistID) {
    throw `Can not get playlistID of ${playlistID}`
  }

  fetch(`https://music.163.com/api/playlist/detail?id=${playlistID}`, {
    method: 'GET',
  }).then(async response => {
    const json = await response.json();

    if (json.code !== 200) {
      throw 'Can not get specified NetEase playlist';
    }

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
  });
}

cron.schedule(cronExpression, main);
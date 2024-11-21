const fs = require('fs');
const cron = require('node-cron');

const cron_expression = process.env.CRON || '0 0 * * *';
const playlistID = process.env.PLAYLIST_ID;

const main = () => {
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

    try {
      fs.writeFileSync('/usr/src/app/xiaomusic_music_list.json', JSON.stringify(xiaomusic_music_list_json), 'utf-8');
      console.log('write file sucsess!');
    } catch (err) {
        console.error('write file failed: ', err);
    }

  });
}

cron.schedule(cron_expression, main);
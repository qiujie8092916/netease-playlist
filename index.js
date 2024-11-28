const fs = require('fs');
const _ = require('lodash')
const cron = require('node-cron');
const path = require('path');
const { playlist_detail, song_url_v1, song_detail} = require('NeteaseCloudMusicApi')

require('dotenv').config();

let old_data;
let new_data;

const cookie = `MUSIC_U=${process.env.MUSIC_U}`;
const playlistID = process.env.PLAYLIST_ID;
const mode = process.env.MODE ?? 'increment';
const cronExpression = process.env.CRON || '0 0 * * *';
const immediately = process.env.IMMEDIATELY || 'false';
const exportPath = '/usr/src/app/music_list';

const main = async () => {
  if (!playlistID) {
    throw `Can not get playlistID of ${playlistID}`
  }
  task();
}

const overwriteFile = (data) => {
  fs.writeFileSync(path.join(exportPath, 'xiaomusic_music_list.json'), JSON.stringify(data), 'utf-8');
}

const task = async () => {
  playlist_detail({
    id: playlistID,
    cookie
  }).then((playlistDetailResponse) => {
    if (playlistDetailResponse.body.code !== 200) {
      throw `requst failed: ${playlistDetailResponse.body.code}`;
    }

    const { playlist } = playlistDetailResponse.body;
    console.log(`[debugger] playlist name:${playlist.name}`);

    const trackIds = playlist.trackIds.map(track => track.id);

    console.log(`[debugger] trackIds`, trackIds);

    Promise.all([song_detail({
      ids: trackIds.join(','),
      cookie,
    })]).then(([songDetailsResponse]) => {
      // const songUrlsJson = songUrlsResponse.body;
      const { songs } = songDetailsResponse.body;

      const musics = (songs ?? []).reduce((acc, detail) => {
        const { id, name } = detail;
        // const urlObj = (songUrlsJson.data ?? []).find(it => it.id === id);

        // if (urlObj && urlObj.url) {
        return acc.concat({
          name,
          url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`
        })
        // }
      }, []);

      new_data = [
        {
          name: playlist.name,
          musics
        }
      ];

      if (fs.existsSync(path)) {
          console.log(`[debugger] folder 【${exportPath}】 exsit`);
      } else {
        console.log(`[debugger] folder 【${exportPath}】 not exsit, creating`);

        try {
          fs.mkdirSync(exportPath, { recursive: true });
          console.log(`[debugger] folder 【${exportPath}】 create success`);
        } catch (err) {
          throw `create folder failed:, ${err}`
        }

        try {
          if (mode === 'increment') {
            try {
              const dataString = fs.readFileSync(path.join(exportPath, 'xiaomusic_music_list.json'), 'utf-8');
              old_data = JSON.parse(dataString);

              let { musics: new_musics } = new_data[0];
              const { musics: old_musics } = old_data[0];

              console.log('[debugger] new_data', JSON.stringify(new_data, null, 2))
              console.log('[debugger] old_data', JSON.stringify(old_data, null, 2))

              const data = _.unionWith(new_musics, old_musics, (a, b) => a.name === b.name);

              overwriteFile(data)
            } catch (e) {
              overwriteFile(new_data)
            }
          } else {
            overwriteFile(new_data)
          }
          console.log('[debugger] write file sucsess!');
        } catch (err) {
            console.error('[debugger] write file failed: ', err);
        }
      }
    })
  }).catch((err) => {
    throw `requst failed: ${err}`;
  });
}

if (immediately === 'true') {
  main();
}

cron.schedule(cronExpression, main);

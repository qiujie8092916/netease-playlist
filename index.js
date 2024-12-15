const fs = require('fs');
const _ = require('lodash')
const axios = require('axios').default;
const cron = require('node-cron');
const path = require('path');
const { playlist_detail, song_download_url, song_detail} = require('NeteaseCloudMusicApi')
const { SingleBar } = require('cli-progress');

require('dotenv').config();

// 已存在的电台歌单
let old_radio_data;
// 新生成的电台歌单
let new_radio_data;
// 下载到本地音乐
/**
 * 记录已成功下载的音乐, 定义为 object[]，增加可扩展性
 * {
 *  name: string; // 歌曲的名字
 *  id: number; // 歌曲的 id
 * }[]
 * 下个定时任务刷新歌单时，更新此变量，并遍历已下载的音乐取交集：
 *    新增的歌曲（之前没下载成功的歌曲），（再次）下载
 *    之前下载了的歌曲，不做任何才做
 *    删除的歌曲，直接删除本地音乐文件
 * 下个定时任务刷新歌单时，以上述逻辑来更新本地下载的音乐，以达到本地下载的音乐与网易云歌单的音乐保持同步，同步时间即为 CRON 的配置
 */
let old_local_data;
let new_local_data;

const cookie = `MUSIC_U=${process.env.MUSIC_U}`;
const playlistID = process.env.PLAYLIST_ID;
const methodString = process.env.METHOD ?? '["radio", "local"]';
const cronExpression = process.env.CRON || '0 0 * * *';
const immediately = process.env.IMMEDIATELY || 'false';
const outdir = process.env.OUTDIR;
const exportPath = '/usr/src/app/music_list';
const xiaomusic_music_list = 'xiaomusic_music_list.json';
const xiaomusic_music_local_list = 'xiaomusic_music_local_list.json';

let method;

const main = async () => {
  if (!playlistID) {
    throw `Can not get playlistID of ${playlistID}`
  }

  try {
    method = JSON.parse(methodString.replace(/'/g, '"'));
  } catch (e) {
    throw `Can not parse method of ${methodString}`
  }

  if (method.includes('local') && !outdir) {
    throw `accepted 'local' in 'METHOD', but have no 'OUTDIR'`;
  }

  task();
}

const overwriteRadioFile = (data) => {
  console.log(`[debugger] ready to write file 【${path.join(exportPath, xiaomusic_music_list)}】...`);
  try {
    fs.writeFileSync(path.join(exportPath, xiaomusic_music_list), JSON.stringify(data), 'utf-8');
    console.log(`[debugger] write file 【${path.join(exportPath, xiaomusic_music_list)}】 sucsess`);
  } catch (err) {
    console.error(`[debugger] write file 【${path.join(exportPath, xiaomusic_music_list)}】 failed: ${err}`);
  }
}

const overwriteLocalFile = (data) => {
  console.log(`[debugger] ready to write file 【${path.join(exportPath, xiaomusic_music_local_list)}】...`);
  try {
    fs.writeFileSync(path.join(exportPath, xiaomusic_music_local_list), JSON.stringify(data), 'utf-8');
    console.log(`[debugger] write file 【${path.join(exportPath, xiaomusic_music_local_list)}】 sucsess`);
  } catch (err) {
    console.error(`[debugger] write file 【${path.join(exportPath, xiaomusic_music_local_list)}】 failed: ${err}`);
  }
}

const splitFileNameAndExt = (filePath) => {
    // 使用 path.basename 获取文件名部分
    const fileName = path.basename(filePath);

    // 使用 path.extname 获取扩展名部分
    const ext = path.extname(fileName);

    // 获取不带扩展名的文件名
    const nameWithoutExt = fileName.slice(0, -ext.length);

    return {
        name: nameWithoutExt,
        extension: ext.startsWith('.') ? ext.slice(1) : ext // 去掉前面的点
    };
}

const createSingleBar = (options)  => {
  return new SingleBar({
    format: '下载进度 |{bar}| {percentage}% || {value}/{total} KB',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    ...options
  });
}

const download = async ({
  url,
  format,
  id,
}) => {
  try {
    const response = await axios({
        method: 'get',
        url,
        responseType: 'stream'
      });

    const totalLength = parseInt(response.headers['content-length'], 10);
    const bar = createSingleBar();
    bar.start(Math.round(totalLength/1024), 0);

    const writer = fs.createWriteStream(path.join(outdir, `${id}.${format}`));
    let downloadedBytes = 0;

    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      bar.update(Math.round(downloadedBytes/1024));
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    bar.stop();
  } catch (e) {
    await new Promise((resolve, reject) => reject(e));
  }
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

    console.log(`[debugger] trackIds`, JSON.stringify(trackIds, null, 2));

    Promise.all([song_detail({
      ids: trackIds.join(','),
      cookie,
    })]).then(async ([songDetailsResponse]) => {
      // const songUrlsJson = songUrlsResponse.body;
      const { songs } = songDetailsResponse.body;

      const musics = (songs ?? []).reduce((acc, detail) => {
        const { id, name } = detail;
        // const urlObj = (songUrlsJson.data ?? []).find(it => it.id === id);

        // if (urlObj && urlObj.url) {
        return acc.concat({
          id,
          name,
        })
        // }
      }, []);

      if (fs.existsSync(exportPath)) {
          console.log(`[debugger] folder 【${exportPath}】 exsit`);
      } else {
        console.log(`[debugger] folder 【${exportPath}】 not exsit, creating...`);

        try {
          fs.mkdirSync(exportPath, { recursive: true });
          console.log(`[debugger] folder 【${exportPath}】 create success`);
        } catch (err) {
          throw `create folder failed:, ${err}`
        }
      }

      if (method.includes('radio')) {
        new_radio_data = [
          {
            name: playlist.name,
            musics: musics.map(({ name, id }) => ({
              name,
              url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`
            }))
          }
        ];

        overwriteRadioFile(new_radio_data)
      }

      if (method.includes('local')) {
        new_local_data = [];
        if (fs.existsSync(path.join(exportPath, xiaomusic_music_local_list))) {
          console.log(`[debugger] file 【${path.join(exportPath, xiaomusic_music_local_list)}】 exsit`);
        } else {
          console.log(`[debugger] file 【${path.join(exportPath, xiaomusic_music_local_list)}】 not exsit, creating...`);

          try {
            overwriteLocalFile([]);
            console.log(`[debugger] file 【${path.join(exportPath, xiaomusic_music_local_list)}】 create success`);
          } catch (err) {
            throw `create file 【${path.join(exportPath, xiaomusic_music_local_list)}】 failed:, ${err}`
          }
        }

        let dataString;
        try {
          dataString = fs.readFileSync(path.join(exportPath, xiaomusic_music_local_list), 'utf-8');
          old_local_data = JSON.parse(dataString);
        } catch (e) {
          console.error(`parse old_local_data failed: ${e}`);
          old_local_data = []
        }

        console.log(`[debugger] musics.length`, musics.length);

        // 更新本地下载的音乐
        // 新增歌曲（之前未成功下载的歌曲）、已经成功下载的歌曲
        for (let i = 0; i < musics.length; i++) {
          const music = musics[i];

          const { id, name } = music;
          // 查找音乐是否已经成功下载
          const downloaded = old_local_data.find(it => it.id === id)
          if (!downloaded) {
            console.log(`[debugger] [${name}](${id}) is not in local, ready to download...`)

            // 新增歌曲（之前未成功下载的歌曲），下载并记录
            try {
              const songDownloadResponse = await song_download_url({
                id,
                // level: 'jymaster',
                cookie,
              });

              const { data: {url, type} } = songDownloadResponse.body;

              console.log(`[debugger] [${name}](${id}) get download url success: `, url, type);

              try {
                await download({
                  url,
                  id,
                  format: type,
                })

                console.log(`[debugger] [${name}](${id}) download success`)

                // 下载成功，记录到 new_local_data
                new_local_data = new_local_data.concat({
                  id,
                  name,
                })
              } catch (e) {
                // 下载失败，打印错误，什么都不做，等到下次 cron 触发更新歌单时再尝试重新下载
                console.error(`[debugger] [${name}](${id}) download failed: ${e.toString()}`)
              }
            } catch(e) {
              console.log(`[debugger] [${name}](${id}) get download url failed: `, e);
            }
          } else {
            console.log(`[debugger] [${downloaded.name}](${downloaded.id}) is in local, do nothing`)
            // 已经下载过的音乐只做记录，直接跳过
            new_local_data = new_local_data.concat({
              id,
              name,
            });
          }
        }

        // 歌单里删除了歌曲
        try {
          // 不知道下载的歌曲的后缀名，只能遍历 outdir 下的所有文件，用 id 来匹配，找出文件名
          const songsFilename = fs.readdirSync(outdir);

          for (let i = 0; i < old_local_data.length; i++) {
            const localSongRecord = old_local_data[i];
            const { id } =  localSongRecord;

            const exist = musics.find(music => music.id === id);
            if (!exist) {
              for(let j = 0; j < songsFilename.length; j++) {
                const songFilename = songsFilename[j];
                const { name: filename } = splitFileNameAndExt(songFilename);
                if (filename === `${id}`) {
                  console.log(`[debugger] ${id} is not in playlist, ready to delete...`)
                  // 歌单里找不到歌曲，说明歌曲已经从歌单里删除，同步删除本地音乐
                  try {
                    await fs.unlinkSync(path.join(outdir, songFilename));
                    console.log(`[debugger] [${songFilename}] delete success`)
                  } catch (err) {
                    console.error(`[debugger] [${songFilename}] delete failed: `, err.toString());
                  }
                }
              }
            }
          }
        } catch (e) {
          throw `readdirSync failed: ${e.toString()}`;
        }
        overwriteLocalFile(new_local_data);
      }
    })
  }).catch((err) => {
    throw `requst failed: ${err.toString()}`;
  });
}

if (immediately === 'true') {
  main();
}

cron.schedule(cronExpression, main);

const fs = require('fs');
const cron = require('node-cron');
const path = require('path');
const { playlist_detail, song_download_url, song_detail} = require('NeteaseCloudMusicApi')
const dayjs = require('dayjs');
const ytdl = require('youtube-dl-exec');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');

require('dotenv').config();

const cookie = `MUSIC_U=${process.env.MUSIC_U}`;
const playlistID = process.env.PLAYLIST_ID;
const methodString = process.env.METHOD ?? '["radio", "local"]';
const cronExpression = process.env.CRON || '0 0 * * *';
const immediately = process.env.IMMEDIATELY || 'false';
const exportPath = '/usr/src/app/music_list';
const xiaomusic_music_list = 'xiaomusic_music_list.json';

let method;

const info = console.log;

const main = async () => {
  if (!playlistID) {
    throw `Can not get playlistID of ${playlistID}`
  }

  try {
    method = JSON.parse(methodString.replace(/'/g, '"'));
  } catch (e) {
    throw `Can not parse method of ${methodString}`
  }

  task();
}

const LoggerError = (...args) => {
  info(dayjs().format('YYYY-MM-DD HH:mm:ss -> [debugger ERROR] '), ...args);
}

const LoggerLog = (...args) => {
  info(dayjs().format('YYYY-MM-DD HH:mm:ss -> [debugger INFO] '), ...args);
}

const LoggerSuccess = (...args) => {
  info(dayjs().format('YYYY-MM-DD HH:mm:ss -> [debugger SUCCESS] '), ...args);
}

const scanDirectory = (dir) => {
  const res = [];
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      res.push(filePath);
    });
    return res;
  } catch (err) {
    throw `Error reading directory: ${err}`;
  }
};

const overwriteRadioFile = (data) => {
  LoggerLog(`ready to write file 【${path.join(exportPath, xiaomusic_music_list)}】...`);
  try {
    fs.writeFileSync(path.join(exportPath, xiaomusic_music_list), JSON.stringify(data), 'utf-8');
    LoggerLog(`write file 【${path.join(exportPath, xiaomusic_music_list)}】 sucsess`);
  } catch (err) {
    LoggerError(`write file 【${path.join(exportPath, xiaomusic_music_list)}】 failed: ${err}`);
  }
}

const splitStringAtLastDot = (str) => {
    const lastDotIndex = str.lastIndexOf('.');

    // 检查最后一个 . 的位置
    if (lastDotIndex === -1) {
        // 如果没有找到 ., 返回原字符串和空字符串
        return [str, ''];
    }

    // 使用 slice 方法拆分字符串
    const firstPart = str.slice(0, lastDotIndex);
    const secondPart = str.slice(lastDotIndex + 1);

    return [firstPart, secondPart];
}

const remove = (pathname, logger) => {
  try {
    fs.unlinkSync(pathname);
    LoggerSuccess(`${logger} delete success`)
  } catch (err) {
    LoggerError(`${logger} delete failed: `, err.toString());
  }
}

const getImageFormat = (imagePath) => {
  const inputImageExtension = path.extname(imagePath).toLowerCase(); // 获取文件格式
  let imageCodec;
  if (inputImageExtension === '.jpg' || inputImageExtension === '.jpeg') {
    imageCodec = 'mjpeg'; // JPEG format
  } else if (inputImageExtension === '.png') {
    imageCodec = 'png'; // PNG format
  } else {
    imageCodec = 'mjpeg'; // Default to JPEG format if unknown
  }
  return imageCodec;
}

const ffmpegInstance = (format, {
  inputAudio,
  inputImage,
  outputAudio,
  title,
  artist,
  album,
}, {
  start,
  end,
  error,
  stderr
}) => {
  const imageCodec = getImageFormat(inputImage);

  const commonOptions = [
    '-metadata', `title=${title}`, // 设置标题
    '-metadata', `artist=${artist}`, // 设置艺术家
    '-metadata', `album=${album}`, // 设置专辑
    '-map', '0', // 选择音频流
    '-map', '1', // 选择封面图片流
    '-disposition:v', 'attached_pic', // 将封面图片标记为附加图片
    '-c:v', imageCodec, // 根据图片格式选择适当的编码器（JPEG 或 PNG）
    '-vf', 'scale=iw/2:ih/2' // 将图片尺寸缩小为原始尺寸的 50%
  ];

  const ffmpegCommand = ffmpeg(inputAudio)
    .input(inputImage)
    .output(outputAudio)
    .audioCodec('copy') // 保持原始音频编码
    .addOption(...commonOptions) // 使用公共选项

  if (format === 'mp3')
    ffmpegCommand.addOption('-id3v2_version', '3');

  if (start)
    ffmpegCommand.on('start', start);

  if (stderr)
    ffmpegCommand.on('stderr', stderr);

  if (end)
    ffmpegCommand.on('end', end);

  if (error)
    ffmpegCommand.on('error', error);

  ffmpegCommand.run();
}

/**
 * 使用 ffmepg 为文件添加元数据
 * @param url
 * @param format
 * @param name
 * @param id
 * @param detail
 * @returns {Promise<never>}
 */
const download = async ({
  url,
  format,
  name,
  id,
  detail
}) => {
  const { al: album, ar: artists } = detail;

  const inputFile = path.join(exportPath, `${name}.${id}.${format}`);
  const tempFile = path.join(exportPath, `${name}.${id}.tmp.${format}`);

  try {
    return new Promise(async (resolve) => {
      await ytdl(url, {
        output: inputFile
      });

      // 下载成功后添加元数据
      // 下载网络图片
      const { picUrl } = album;
      const picName = picUrl.slice(picUrl.lastIndexOf('/') + 1);

      const pic = path.join(exportPath, picName);

      axios({
        url: picUrl,
        responseType: 'arraybuffer',
      }).then(async (response) => {
        // 将图片保存到临时文件
        try {
          fs.writeFileSync(pic, response.data);
          ffmpegInstance(format, {
            inputAudio: inputFile,
            inputImage: pic,
            outputAudio: tempFile,
            title: name,
            artist: artists.map(it => it.name).join(','),
            album: album.name,
          }, {
            start: (commandLine) => {
              LoggerLog(`[${name}](${id}) commandLine: ${commandLine}`);
            },
            // stderr: (stderrLine) => {
            //   LoggerLog(`[${name}](${id}) FFmpeg stderr: ${stderrLine}`);
            // },
            end: () => {
              LoggerLog(`[${name}](${id}) Metadata and cover modifications are complete.`);

              // 用临时文件覆盖原始文件
              fs.rename(tempFile, inputFile, async (err) => {
                if (err) {
                  LoggerError(`[${name}](${id}) Failed to overwrite the file: ${err}`);
                }
                return resolve();
              });
            },
            error: async (err) => {
              LoggerError(`[${name}](${id}) Processing failed: ${err}`);
              return resolve();
            }
          })
        } catch (err) {
          // 图片保存到临时文件失败，什么都不做
          LoggerError(`[${name}](${id}) Cover image download failed: ${err}`);
          return resolve();
        }
      }).catch((err) => {
        // 图片下载，什么都不做
        LoggerError(`[${name}](${id}) Unable to download cover image: ${err}`);
        return resolve();
      });
    });
  } catch (e) {
    return Promise.reject(e);
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
    LoggerLog(`playlist name:${playlist.name}`);

    const trackIds = playlist.trackIds.map(track => track.id);

    LoggerLog(`trackIds`, JSON.stringify(trackIds));

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
          detail: detail
        })
        // }
      }, []);

      if (fs.existsSync(exportPath)) {
          LoggerLog(`folder 【${exportPath}】 exsit`);
      } else {
        LoggerLog(`folder 【${exportPath}】 not exsit, creating...`);

        try {
          fs.mkdirSync(exportPath, { recursive: true });
          LoggerSuccess(`folder 【${exportPath}】 create success`);
        } catch (err) {
          throw `create folder failed:, ${err}`
        }
      }

      LoggerLog(`musics.length`, musics.length);

      if (method.includes('radio')) {
        const new_radio_data = [
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
        // 更新本地下载的音乐
        // 新增歌曲（之前未成功下载的歌曲）、已经成功下载的歌曲
        for (let i = 0; i < musics.length; i++) {
          const music = musics[i];

          const { id, name: originName, detail } = music;
          const name = originName.replace(/\//g, '')
          // 查找音乐是否已经成功下载
          const old_local_data = scanDirectory(exportPath);
          const downloaded = old_local_data.find(it => path.parse(it).name === `${name}.${id}`);

          if (downloaded && path.parse(downloaded).ext !== '.part') {
              // 之前下载成功
              // 不做任何操作
              continue;
          }

          if (downloaded && path.parse(downloaded).ext === '.part') {
            // 之前下载失败
            // 删除过程文件
            remove(path.join(exportPath, downloaded), `[${downloaded}]`)
          }

          console.log('\n');
          LoggerLog(`[${name}](${id}) is not in local, ready to download...`)

          // 新增歌曲（之前未成功下载的歌曲），下载并记录
          try {
            const songDownloadResponse = await song_download_url({
              id,
              // level: 'jymaster',
              cookie,
            });

            const { data: { url, type } } = songDownloadResponse.body;

            LoggerSuccess(`[${name}](${id}) get download url success: `, url, type);

            try {
              await download({
                url,
                id,
                name,
                format: type,
                detail
              })

              LoggerSuccess(`[${name}](${id}) download success`);
            } catch (e) {
              // 下载失败，打印错误，什么都不做，等到下次 cron 触发更新歌单时再尝试重新下载
              LoggerError(`[${name}](${id}) download failed: ${e.toString()}`)
            }
          } catch(e) {
            LoggerLog(`[${name}](${id}) get download url failed: `, e);
          }
        }

        // 歌单里删除了歌曲
        // 同时也会清楚垃圾 / 中间文件
        try {
          // 不知道下载的歌曲的后缀名，只能遍历 exportPath 下的所有文件，用 name + id 来匹配，找出文件名，并删除文件
          const old_local_data = scanDirectory(exportPath);

          for (let i = 0; i < old_local_data.length; i++) {
            const localSongRecord = old_local_data[i];
            const { name: fullName, ext, base } =  path.parse(localSongRecord);

            if (ext === '.part') {
              // 过滤掉未成功下载的
              continue;
            }

            const [, id] = splitStringAtLastDot(fullName);

            const exist = musics.find(music => `${music.id}` === `${id}`);

            if (!exist) {
              remove(path.join(exportPath, base), `[${base}]`);
            }
          }
        } catch (e) {
          throw `readdirSync failed: ${e.toString()}`;
        }
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

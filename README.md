通过网易云音乐歌单 ID，下载歌曲或[生成歌单配置](https://github.com/hanxi/xiaomusic/issues/269)  
本程序为独立模块，可 docker 部署，可作为不用[插件](https://github.com/hanxi/xiaomusic/issues/105)的另外实现方式

### docker
```
qiujie8092916/netease-playlist
```
  
  
### docker volumes
- /xxx/.env:/usr/src/app/.env
- /xxx/music_list:/usr/src/app/music_list


### TIPS
- 歌单方式更新时采用全量覆盖
- 新增本地音乐方式，历史阶段发现：
  - 使用 [获取音乐 url - 新版](https://neteasecloudmusicapi.ivelly.com/docs/#/?id=%e8%8e%b7%e5%8f%96%e9%9f%b3%e4%b9%90-url-%e6%96%b0%e7%89%88) 歌曲链接方式，链接有有效期，如果作为音乐的在线播放地址，播放音乐的时候链接可能失效
  - 使用 `https://music.163.com/song/media/outer/ur` 外链的方式([获取网易云音乐永久外链](https://pelom.cn/archives/107/))，有些音乐的地址可能是 404，所以另外新增 local 的方式
  - 目前同时保留歌单方式，依然采用 `https://music.163.com/song/media/outer/ur` 外链。并提供 `METHOD` 的环境变量以支持两种方式
  - radio 方式:
    - 通过本地起 NG 的方式，获取歌单链接，可不用将歌单链接暴露在公网 
    - 也可将歌单链接挂在 CDN 上，参考：[已支持配置自定义网络歌单，在这里分享你的歌单](https://github.com/hanxi/xiaomusic/issues/78)
  - local 方式
    - 通过将下载的目录挂在到[本地音乐目录](https://github.com/hanxi/xiaomusic/issues/98)
    - 设置刷新歌单 cron（[定时任务配置格式](https://github.com/hanxi/xiaomusic/issues/182)）：
    ```json
    [
        {
            "expression": "* * * * *",
            "name": "refresh_music_list"
        }
    ]
    ```


### 环境变量
| Variable Name | Required | Comment                                                                                                                       |  
|---------------|----------|-------------------------------------------------------------------------------------------------------------------------------|  
| CRON          | F        | 循环的 CRON。默认：0 0 * * *                                                                                                         |  
| PLAYLIST_ID   | T        | 网易云音乐歌单 ID                                                                                                                    |
| MUSIC_U       | T        | 网易云音乐的 web cookie，有效期有一年多，没有 cookie，可能不能获取歌曲的播放地址                                                                             |
| IMMEDIATELY   | F        | 是否立即执行。默认：false                                                                                                               |
| METHOD        | F        | 默认: ["radio", "local"], 歌单方式、本地音乐方式                                                                                           |
| OUTDIR        | F        | 若 `METHOD` 包含 'local'，则需要传入下载输出的路径，此路径可以挂载到 [xiaomusic](https://github.com/hanxi/xiaomusic) 的 `XIAOMUSIC_DOWNLOAD_PATH` 对应的路径 |


### 鸣谢
- [xiaomusic](https://github.com/hanxi/xiaomusic)
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)
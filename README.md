通过网易云音乐歌单 ID，生成 [xiaomusic#269](https://github.com/hanxi/xiaomusic/issues/269) 的歌单内容
本程序为独立模块，可 docker 部署，是不用[插件](https://github.com/hanxi/xiaomusic/issues/105)的另外实现方式

### docker
```
qiujie8092916/netease-playlist
```
  
  
### docker volumes
- /xxx/.env:/usr/src/app/.env
- /xxx/music_list:/usr/src/app/music_list


### 环境变量
| 变量名         | 必须 | 描述                                                |  
|-------------|----|---------------------------------------------------|  
| CRON        | F  | 循环的 CRON。默认：0 0 * * *                             |  
| PLAYLIST_ID | T  | 网易云音乐歌单 ID                                        |
| MUSIC_U     | T  | 网易云音乐的 web cookie，有效期有一年多，没有 cookie，可能不能获取歌曲的播放地址 |
| IMMEDIATELY | F  | 是否立即执行。默认：false                                   |
| MODE        | F  | 全文覆盖还是增量覆盖。默认：'increment', 参考值：all、increment                        |


### 自行探索
1. 通过本地起 NG 的方式，获取歌单链接，可不用将歌单链接暴露在公网
2. 也可将歌单链接挂在 CDN 上，参考：[已支持配置自定义网络歌单，在这里分享你的歌单](https://github.com/hanxi/xiaomusic/issues/78)

### 鸣谢
- [xiaomusic](https://github.com/hanxi/xiaomusic)
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)
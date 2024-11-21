通过网易云音乐歌单 ID，生成 [xiaomusic](https://github.com/hanxi/xiaomusic") 的在线歌单地址

### docker 配置
- /xxx/.env:/usr/src/app/.env
- /xxx/music_list:/usr/src/app/music_list


### 环境变量
| 变量名   | 必须 | 描述                                             |  
|--------|----|------------------------------------------------|  
| CRON   | F  | 循环的 CRON。默认：0 0 * * *                          |  
| PLAYLIST_ID   | T  | 网易云音乐歌单 ID                                     |
| RETRY_COUNT   | F  | 重试次数。默认：10                                     |
| COOKIE   | F  | 网易云音乐的 web cookie，没有 cookie 的话只能获取前 10 首。默认：'' |
| IMMEDIATELY   | F  | 是否立即执行。默认：false                                |
思迹官网 · 服务器部署包
========================

站点地址：http://42.194.228.111
线上预览：https://hogong03.github.io/siji-site/

包内容
------
index.html / main.js / styles.css      官网页面
assets/                                图标、介绍片、下载二维码
download/siji-v4.35.2.apk              Android 安装包（15.0 MB）
deploy-site.ps1                        一键部署脚本（备份旧站 + 替换）
free-memory.ps1                        可选：停掉管理后台与数据库腾内存


部署步骤（任选一种）
--------------------
【A】宝塔面板（推荐，不用远程桌面）
  1. 宝塔 → 文件 → /wwwroot/siji/   （Windows 版路径 C:\BtSoft\wwwroot\siji）
  2. 上传 siji-site-server.zip
  3. 解压到 dist 目录，覆盖同名文件
  4. 浏览器打开 http://42.194.228.111 验证

【B】远程桌面 + PowerShell（带自动备份）
  1. 远程桌面登录服务器，把 siji-site-server.zip 放到桌面
  2. 以管理员身份打开 PowerShell，执行：
       Expand-Archive "$env:USERPROFILE\Desktop\siji-site-server.zip" -DestinationPath "$env:USERPROFILE\Desktop\siji-site" -Force
       powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Desktop\siji-site\deploy-site.ps1" -Zip "$env:USERPROFILE\Desktop\siji-site-server.zip"
  3. 脚本会先把旧站备份成 dist-backup-<时间戳>，再替换

可选项：释放内存
----------------
静态官网只需要 Nginx，管理后台（PM2: siji-admin）与 MariaDB 占着几百 MB。
如果不再需要管理后台，管理员 PowerShell 执行：
    powershell -ExecutionPolicy Bypass -File .\free-memory.ps1
它会停掉 siji-admin 与数据库服务（数据文件不动，只停进程）。
要恢复：MySQL 服务改回自动启动；pm2 resurrect 恢复后台（需此前 pm2 save 过）。

注意
----
· 下载二维码当前指向线上预览地址（github.io）；官网迁到 42.194.228.111 后如需改写，
  替换 assets/download-qr.png 即可（二维码内容是固定图片）。
· 思迹 App 完全离线运行，不依赖这台服务器；服务器只提供安装包与介绍页。

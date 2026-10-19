<#
  deploy-site.ps1 — 把思迹官网替换到 Nginx 站点根目录（在【服务器上】以管理员身份运行）

  用法：
    powershell -ExecutionPolicy Bypass -File deploy-site.ps1 -Zip C:\Users\Administrator\Desktop\siji-site-server.zip

  做三件事：
    1) 备份旧 dist 到 C:\BtSoft\wwwroot\siji\dist-backup-<时间戳>
    2) 清空旧 dist，解压新站点
    3) 校验 index.html 存在，并打印访问地址

  不影响：Nginx 配置、宝塔面板、数据库。静态站不需要 reload nginx。
#>
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [string]$Root = 'C:\BtSoft\wwwroot\siji'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Zip)) { throw "找不到压缩包: $Zip" }
if (-not (Test-Path $Root)) { throw "站点目录不存在: $Root（确认宝塔站点路径）" }

$dist = Join-Path $Root 'dist'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (Test-Path $dist) {
  $backup = Join-Path $Root "dist-backup-$stamp"
  Copy-Item $dist $backup -Recurse -Force
  Write-Host "[1/3] 旧站已备份到 $backup"
  Get-ChildItem $dist -Force | Remove-Item -Recurse -Force
  Write-Host "[2/3] 旧站已清空"
} else {
  New-Item -ItemType Directory -Force -Path $dist | Out-Null
  Write-Host "[1/3] dist 不存在，已新建"
}

Expand-Archive -Path $Zip -DestinationPath $dist -Force
foreach ($f in @('deploy-site.ps1', 'free-memory.ps1', 'README.txt')) {
  Remove-Item (Join-Path $dist $f) -Force -ErrorAction SilentlyContinue
}

$index = Join-Path $dist 'index.html'
if (-not (Test-Path $index)) { throw "解压后找不到 index.html，部署中止（旧站备份仍在）" }
$apk = Get-ChildItem (Join-Path $dist 'download') -Filter *.apk -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $apk) { Write-Warning "download 目录里没有找到 APK，下载按钮会 404" }

Write-Host "[3/3] 部署完成"
Write-Host "      访问: http://42.194.228.111"
Write-Host ("      APK : {0} ({1:N1} MB)" -f $apk.Name, ($apk.Length / 1MB))
Write-Host "      回滚: 把 dist-backup-$stamp 改回 dist 即可"

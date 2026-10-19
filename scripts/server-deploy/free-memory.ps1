<#
  free-memory.ps1 — 可选：停掉管理后台（PM2: siji-admin）与本地数据库，给静态官网腾内存

  前提：官网是纯静态站，只依赖 Nginx；管理后台与 MariaDB 对官网没有作用。

  会做两件事：
    1) pm2 delete siji-admin + pm2 save（后端进程不再自启）
    2) 停止系统里的 MySQL/MariaDB 服务，并把启动类型改成「手动」

  回滚：把 MySQL 服务改回自动并启动；`pm2 resurrect` 可恢复后台（前提是之前 pm2 save 过）。
  数据库文件不会被删除，只是不跑进程。
#>
$ErrorActionPreference = 'Continue'

$nodeDir = 'C:\BtSoft\nodejs\node-v20.18.0-win-x64'
$pm2 = Join-Path $nodeDir 'pm2.cmd'

if (Test-Path $pm2) {
  $env:PATH = "$nodeDir;$env:PATH"
  Write-Host '[1/2] 停用 PM2 应用 siji-admin'
  & $pm2 delete siji-admin 2>&1 | Write-Host
  & $pm2 save 2>&1 | Write-Host
} else {
  Write-Host "[1/2] 跳过 PM2（找不到 $pm2）"
}

Write-Host '[2/2] 停止数据库服务'
$found = $false
foreach ($name in @('MySQL', 'MariaDB', 'mysql', 'mariadb', 'MySQL80')) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($svc) {
    $found = $true
    try {
      Stop-Service -Name $name -Force -ErrorAction Stop
      Set-Service -Name $name -StartupType Manual -ErrorAction Stop
      Write-Host "      已停止并改为手动启动: $name"
    } catch {
      Write-Host "      $name 停止失败: $($_.Exception.Message)"
    }
  }
}
if (-not $found) { Write-Host '      没找到 MySQL/MariaDB 服务，跳过' }

Write-Host '完成。释放后剩余占用主要是 Nginx 与宝塔面板进程。'

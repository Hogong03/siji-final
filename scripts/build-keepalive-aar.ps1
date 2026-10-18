<#
  build-keepalive-aar.ps1 — 构建 siji-keepalive.aar（4.35.0）

  为什么不用 Gradle / Android Studio：这个插件只做一件事（起一个前台服务），
  没有资源、没有 androidx 依赖，javac + zip 就够。产物 AAR = classes.jar + AndroidManifest.xml。

  唯一外部依赖：一份 android.jar（Android SDK 的 platforms/android-XX/android.jar）。
  没有 SDK 时下载方式见 docs/后台保活方案.md 第 2 节。

  用法：
    pwsh -File scripts/build-keepalive-aar.ps1
    pwsh -File scripts/build-keepalive-aar.ps1 -AndroidJar "D:\android-sdk\platforms\android-34\android.jar"
#>
param(
  [string]$AndroidJar = "",
  [string]$JdkHome = $env:JAVA_HOME
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $root 'native\keepalive\src\main'
$outDir = Join-Path $env:TEMP ('siji-keepalive-build-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$pluginDir = Join-Path $root 'nativeplugins\siji-keepalive\android'
$aarPath = Join-Path $pluginDir 'siji-keepalive.aar'

# ---------- 1. 定位 android.jar ----------
$candidates = @()
if ($AndroidJar) { $candidates += $AndroidJar }
if ($env:ANDROID_JAR) { $candidates += $env:ANDROID_JAR }
if ($env:ANDROID_HOME) { $candidates += (Join-Path $env:ANDROID_HOME 'platforms\android-34\android.jar') }
if ($env:ANDROID_SDK_ROOT) { $candidates += (Join-Path $env:ANDROID_SDK_ROOT 'platforms\android-34\android.jar') }
$candidates += 'C:\Users\c3798\AppData\Local\dsh-android\platform-34\android-34\android.jar'
$candidates += (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platforms\android-34\android.jar')

$androidJarResolved = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $androidJarResolved) {
  throw "找不到 android.jar。请传 -AndroidJar <path>，或按 docs/后台保活方案.md 第 2 节安装 Android SDK。"
}
Write-Host "[1/5] android.jar: $androidJarResolved"

# ---------- 2. 定位 javac ----------
$javac = $null
if ($JdkHome) {
  $try = Join-Path $JdkHome 'bin\javac.exe'
  if (Test-Path $try) { $javac = $try }
}
if (-not $javac) {
  $cmd = Get-Command javac -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { $javac = $cmd.Source }
}
if (-not $javac) { throw "找不到 javac，请安装 JDK 8+ 并设置 JAVA_HOME。" }
Write-Host "[2/5] javac: $javac"

# ---------- 3. 编译 ----------
$classesDir = Join-Path $outDir 'classes'
New-Item -ItemType Directory -Force -Path $classesDir | Out-Null
$sources = Get-ChildItem (Join-Path $srcDir 'java') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
if (-not $sources) { throw "没有找到 Java 源码（$srcDir\java）" }

& $javac --version 2>$null | Out-Null
$isJdk8 = (& $javac -version 2>&1) -match '^javac 1\.8'
# JDK 8 / 17 / 20 都吃 -source 8 -target 8 + -bootclasspath，行为一致，避免 --release 的差异
$javacArgs = @('-encoding', 'UTF-8', '-source', '8', '-target', '8',
  '-bootclasspath', $androidJarResolved, '-classpath', $androidJarResolved,
  '-d', $classesDir) + $sources
if (-not $isJdk8) { $javacArgs = @('-Xlint:-options') + $javacArgs }
Write-Host "[3/5] javac ($(if($isJdk8){'jdk8'}else{'jdk9+'})) 编译 $($sources.Count) 个文件"
& $javac @javacArgs
if ($LASTEXITCODE -ne 0) { throw "javac 失败（exit $LASTEXITCODE）" }

# ---------- 4. 打 classes.jar ----------
$jarExe = $null
$jarCandidates = @()
if ($JdkHome) { $jarCandidates += (Join-Path $JdkHome 'bin\jar.exe') }
$jarCmd = Get-Command jar -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jarCmd) { $jarCandidates += $jarCmd.Source }
$jarExe = $jarCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $jarExe) { throw "找不到 jar 工具（JDK 的 bin/jar.exe）" }

$stageDir = Join-Path $outDir 'aar'
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
Copy-Item (Join-Path $srcDir 'AndroidManifest.xml') (Join-Path $stageDir 'AndroidManifest.xml')
$classesJar = Join-Path $stageDir 'classes.jar'
Push-Location $classesDir
try {
  & $jarExe cf $classesJar .
  if ($LASTEXITCODE -ne 0) { throw "jar 打包失败（exit $LASTEXITCODE）" }
} finally { Pop-Location }
Write-Host "[4/5] classes.jar: $([math]::Round((Get-Item $classesJar).Length/1KB,1)) KB"

# ---------- 5. 打 AAR ----------
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
if (Test-Path $aarPath) { Remove-Item $aarPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stageDir, $aarPath)
Write-Host "[5/5] AAR: $aarPath ($([math]::Round((Get-Item $aarPath).Length/1KB,1)) KB)"

Remove-Item $outDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "完成。下一步：HBuilderX 勾选本地插件 + 自定义基座/云打包，见 docs/后台保活方案.md 第 3 节"

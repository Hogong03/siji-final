<#
  build-keepalive-aar.ps1 — 构建 siji-keepalive.aar（4.35.2）

  为什么不用 Gradle / Android Studio：这个插件只有两个类 + 一份 manifest，
  没有资源、没有 androidx 依赖，javac + zip 就够。产物 AAR = classes.jar + AndroidManifest.xml。

  唯一外部依赖：一份 android.jar（Android SDK 的 platforms/android-XX/android.jar）。
  没有 SDK 时下载方式见 docs/后台保活方案.md 第 2 节。

  4.35.2：新增 stub 编译阶段。模块类 SijiKeepAliveModule 依赖 DCloud 运行时类
  （UniModule / WXModule / AbsSDKInstance / UniJSCallback / UniJSMethod / fastjson），
  本仓库没有 uniapp SDK，用 native/keepalive/stubs/ 下的同 FQN stub 参与编译。
  stub 只进 classpath，绝不进 aar —— 否则和基座运行时同名类冲突，打包即炸。
  所以第 5 步加了泄漏闸门：classes 里出现 com/siji/keepalive 之外的类直接 fail。

  用法：
    powershell -File scripts/build-keepalive-aar.ps1
    powershell -File scripts/build-keepalive-aar.ps1 -AndroidJar "D:\android-sdk\platforms\android-34\android.jar"
#>
param(
  [string]$AndroidJar = "",
  [string]$JdkHome = $env:JAVA_HOME
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $root 'native\keepalive\src\main'
$stubDir = Join-Path $root 'native\keepalive\stubs'
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
Write-Host "[1/7] android.jar: $androidJarResolved"

# ---------- 2. 定位 javac / jar ----------
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
Write-Host "[2/7] javac: $javac"

$jarExe = $null
$jarCandidates = @()
if ($JdkHome) { $jarCandidates += (Join-Path $JdkHome 'bin\jar.exe') }
$jarCmd = Get-Command jar -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jarCmd) { $jarCandidates += $jarCmd.Source }
$jarExe = $jarCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $jarExe) { throw "找不到 jar 工具（JDK 的 bin/jar.exe）" }

$isJdk8 = (& $javac -version 2>&1) -match '^javac 1\.8'

# ---------- 3. 编译 stub（只进 classpath，不进 aar） ----------
$stubClassesDir = Join-Path $outDir 'stub-classes'
New-Item -ItemType Directory -Force -Path $stubClassesDir | Out-Null
$stubSources = Get-ChildItem $stubDir -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
if (-not $stubSources) { throw "没有找到 stub 源码（$stubDir）" }
$stubArgs = @('-encoding', 'UTF-8', '-source', '8', '-target', '8',
  '-bootclasspath', $androidJarResolved, '-classpath', $androidJarResolved,
  '-d', $stubClassesDir) + $stubSources
if (-not $isJdk8) { $stubArgs = @('-Xlint:-options') + $stubArgs }
Write-Host "[3/7] javac 编译 stub $($stubSources.Count) 个文件（compile-only，不进 aar）"
& $javac @stubArgs
if ($LASTEXITCODE -ne 0) { throw "stub javac 失败（exit $LASTEXITCODE）" }

# ---------- 4. 编译插件源码（classpath = android.jar + stub classes） ----------
$classesDir = Join-Path $outDir 'classes'
New-Item -ItemType Directory -Force -Path $classesDir | Out-Null
$sources = Get-ChildItem (Join-Path $srcDir 'java') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
if (-not $sources) { throw "没有找到 Java 源码（$srcDir\java）" }
$javacArgs = @('-encoding', 'UTF-8', '-source', '8', '-target', '8',
  '-bootclasspath', $androidJarResolved, '-classpath', "$androidJarResolved;$stubClassesDir",
  '-d', $classesDir) + $sources
if (-not $isJdk8) { $javacArgs = @('-Xlint:-options') + $javacArgs }
Write-Host "[4/7] javac ($(if($isJdk8){'jdk8'}else{'jdk9+'})) 编译插件 $($sources.Count) 个文件"
& $javac @javacArgs
if ($LASTEXITCODE -ne 0) { throw "插件 javac 失败（exit $LASTEXITCODE）" }

# ---------- 5. 闸门：插件 classes 里不允许出现 stub 包 ----------
$leaked = Get-ChildItem $classesDir -Recurse -Filter '*.class' | Where-Object {
  $_.FullName -notmatch 'com[\\/]siji[\\/]keepalive'
}
if ($leaked) {
  $leaked | ForEach-Object { Write-Host "  泄漏: $($_.FullName)" }
  throw "stub 类泄漏进插件 classes —— 会和基座运行时同名类冲突，构建终止"
}

# ---------- 6. 打 classes.jar ----------
$stageDir = Join-Path $outDir 'aar'
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
Copy-Item (Join-Path $srcDir 'AndroidManifest.xml') (Join-Path $stageDir 'AndroidManifest.xml')
$classesJar = Join-Path $stageDir 'classes.jar'
Push-Location $classesDir
try {
  & $jarExe cf $classesJar .
  if ($LASTEXITCODE -ne 0) { throw "jar 打包失败（exit $LASTEXITCODE）" }
} finally { Pop-Location }
Write-Host "[5/7] 泄漏闸门通过，classes.jar: $([math]::Round((Get-Item $classesJar).Length/1KB,1)) KB"

# ---------- 7. 打 AAR + 复核 ----------
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
if (Test-Path $aarPath) { Remove-Item $aarPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stageDir, $aarPath)
Write-Host "[6/7] AAR: $aarPath ($([math]::Round((Get-Item $aarPath).Length/1KB,1)) KB)"

# 复核：aar 里的 classes.jar 必须含模块类与服务类（package.json plugins[].class 指向模块类）
$check = Join-Path $outDir 'check.jar'
$zip = [System.IO.Compression.ZipFile]::OpenRead($aarPath)
try {
  $entry = $zip.Entries | Where-Object { $_.FullName -eq 'classes.jar' }
  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $check, $true)
} finally { $zip.Dispose() }
$zip2 = [System.IO.Compression.ZipFile]::OpenRead($check)
try {
  $names = @($zip2.Entries | ForEach-Object { $_.FullName })
} finally { $zip2.Dispose() }
$required = @('com/siji/keepalive/SijiKeepAliveModule.class', 'com/siji/keepalive/SijiKeepAliveService.class')
$missing = @($required | Where-Object { $names -notcontains $_ })
if ($missing.Count -gt 0) { throw "classes.jar 缺少必需类: $($missing -join ', ')" }
Write-Host "[7/7] 复核通过：模块类与服务类均在 aar 内（$($names.Count) 个条目）"

Remove-Item $outDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "完成。下一步：HBuilderX 勾选本地插件 + 自定义基座/云打包，见 docs/后台保活方案.md 第 3 节"

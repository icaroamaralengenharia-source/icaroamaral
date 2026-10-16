param([string]$WorkRoot, [switch]$TestOnly, [string]$QaInferenceBaseUrl='')
$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
$taskWorkspace=Split-Path $taskProject -Parent
$taskArtifacts=Join-Path $taskWorkspace 'tmp\elo-brain-native-20261014'
if(-not $WorkRoot) { $WorkRoot=Join-Path $taskArtifacts 'android-build-work' }
$taskWork=[IO.Path]::GetFullPath($WorkRoot)
$taskDrive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($taskWork))
$taskBaseline=[IO.Path]::GetFullPath((Join-Path $taskProject '..\..\android-elo-native-header-qa-20261008\app\src\main\assets'))
$taskAssetBytes=(Get-ChildItem -LiteralPath $taskBaseline -Recurse -File | Measure-Object Length -Sum).Sum
$taskModel=Join-Path $taskProject 'model-assets\elo-wake-pt'
if(-not(Test-Path -LiteralPath (Join-Path $taskModel 'am\final.mdl')) -and -not(Test-Path -LiteralPath (Join-Path $taskModel 'final.mdl'))) { throw 'LOCAL_MODEL_NOT_PREPARED' }
$taskModelBytes=(Get-ChildItem -LiteralPath $taskModel -Recurse -File | Measure-Object Length -Sum).Sum
$taskEstimate=[Math]::Max(2.5GB,4*($taskAssetBytes+$taskModelBytes)+700MB)
$taskMerged=Join-Path $taskWork 'app-build\intermediates\assets\debug\mergeDebugAssets'
$taskCachedAssetBytes=0
$taskDexCache=Join-Path $taskWork 'app-build\intermediates\dex\debug\mergeExtDexDebug'
$taskNativeCacheReady=(Test-Path -LiteralPath (Join-Path $taskWork 'project-cache')) -and
 (Test-Path -LiteralPath $taskDexCache) -and
 (@(Get-ChildItem -LiteralPath $taskDexCache -Filter '*.dex' -Recurse -File -ErrorAction SilentlyContinue).Count -gt 0)
if($taskNativeCacheReady) {
 # Dependencies and DEX are already materialized. Reserve merged assets,
 # compression and final APK concurrently, native library outputs and 768 MiB
 # headroom. The verifier moves the APK; there is no second staging copy.
 $taskEstimate=[Math]::Max(1.75GB,3*($taskAssetBytes+$taskModelBytes)+768MB)
}
if(Test-Path -LiteralPath $taskMerged) {
 $taskCachedAssetBytes=(Get-ChildItem -LiteralPath $taskMerged -Recurse -File | Measure-Object Length -Sum).Sum
 if($taskCachedAssetBytes -ge ($taskAssetBytes+$taskModelBytes)) {
  # Assets/dependencies already materialized by this execution. Budget the APK,
  # its staging copy, remaining code outputs and at least 512 MiB headroom.
  $taskEstimate=[Math]::Max(1.5GB,2*($taskAssetBytes+$taskModelBytes)+512MB)
 }
}
$taskStamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')
if($TestOnly -and $taskCachedAssetBytes -ge ($taskAssetBytes+$taskModelBytes)) { $taskEstimate=512MB }
$taskPreflight=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');free=$taskDrive.AvailableFreeSpace;preferred=5GB;requiredEstimate=$taskEstimate;existingAssets=$taskAssetBytes;modelBytes=$taskModelBytes;cachedAssets=$taskCachedAssetBytes;nativeCacheReady=$taskNativeCacheReady;workRoot=$taskWork;dataDeleted=$false}
$taskPreflight | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskArtifacts ('build-preflight-'+$taskStamp+'.json')) -Encoding utf8
if($taskDrive.AvailableFreeSpace -lt $taskEstimate) { throw 'BUILD_BLOCKED_INSUFFICIENT_SAFE_SPACE' }
[IO.Directory]::CreateDirectory($taskWork) | Out-Null
$taskGradle=Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.10.2-bin') -Recurse -File -Filter 'gradle.bat' | Select-Object -First 1 -ExpandProperty FullName
if(-not $taskGradle) { throw 'CACHED_GRADLE_UNAVAILABLE' }
$taskLocal=Join-Path $taskProject 'local.properties'
if(-not(Test-Path -LiteralPath $taskLocal)) { [IO.File]::WriteAllText($taskLocal,'sdk.dir=C\:\\Android\\Sdk',[Text.UTF8Encoding]::new($false)) }
$taskLog=Join-Path $taskArtifacts ('native-build-'+$taskStamp+'.log')
$taskJavaSettings=@(& java '-XshowSettings:properties' '-version' 2>&1)
$taskEncodingLine=$taskJavaSettings | Select-String '^\s*native.encoding\s*=\s*(.+)$' | Select-Object -First 1
if(-not $taskEncodingLine) { throw 'JAVA_NATIVE_ENCODING_UNAVAILABLE' }
$taskNativeEncoding=$taskEncodingLine.Matches[0].Groups[1].Value.Trim()
$taskArgs=@('--no-daemon','--max-workers=1','--offline','--console=plain','--project-dir',$taskProject,
 '--project-cache-dir',(Join-Path $taskWork 'project-cache'),('-Dorg.gradle.jvmargs=-Xmx512m -XX:MaxMetaspaceSize=384m -Dfile.encoding='+$taskNativeEncoding+' -Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false "-Djdk.net.unixdomain.tmpdir='+$taskWork+'"'),
 '-Pkotlin.compiler.execution.strategy=in-process',
 '--stacktrace',
 ('-PeloWorkRoot='+$taskWork),('-PeloBaselineAssets='+$taskBaseline),
 'testDebugUnitTest','--tests','br.com.icaroamaral.elo.EloVoiceCoordinatorTest',
 '--tests','br.com.icaroamaral.elo.EloConversationTranscriptTest',
 '--tests','br.com.icaroamaral.elo.EloCanonicalVoiceClientTest',
 '--tests','br.com.icaroamaral.elo.EloVoiceUtteranceBufferTest',
 '--tests','br.com.icaroamaral.elo.EloNativeMusicIntentTest',
 '--tests','br.com.icaroamaral.elo.EloMusicPlayerCoordinatorTest',
 '--tests','br.com.icaroamaral.elo.EloBundledWebResourcePolicyTest',
 '--tests','br.com.icaroamaral.elo.EloSpeechInterruptDecisionTest')
if(-not $TestOnly) { $taskArgs += 'assembleDebug' }
if($QaInferenceBaseUrl) { $taskArgs += ('-PeloQaInferenceBaseUrl='+$QaInferenceBaseUrl) }
$taskLauncher=Join-Path (Split-Path (Split-Path $taskGradle -Parent) -Parent) 'lib\gradle-launcher-8.10.2.jar'
$taskPreviousJavaOptions=$env:JDK_JAVA_OPTIONS
try {
 # Applies to this process tree only, including Gradle's single-use JVM. The long
 # project path makes the JDK use its TCP pipe fallback instead of broken AF_UNIX.
 $env:JDK_JAVA_OPTIONS='"-Djdk.net.unixdomain.tmpdir='+$taskWork+'" -Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false'
 & java -cp $taskLauncher org.gradle.launcher.GradleMain @taskArgs *> $taskLog
 $taskExit=$LASTEXITCODE
} finally { $env:JDK_JAVA_OPTIONS=$taskPreviousJavaOptions }
Get-Content -LiteralPath $taskLog -Tail 70
[ordered]@{exitCode=$taskExit;log=$taskLog;workRoot=$taskWork;freeAfter=$taskDrive.AvailableFreeSpace;installed=$false} | ConvertTo-Json
exit $taskExit

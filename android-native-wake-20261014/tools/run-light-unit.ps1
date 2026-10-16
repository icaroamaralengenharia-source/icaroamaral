$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
$taskWorkspace=Split-Path $taskProject -Parent
$taskArtifacts=Join-Path $taskWorkspace 'tmp\elo-brain-native-20261014'
$taskCache=Join-Path $env:USERPROFILE '.gradle\caches\modules-2\files-2.1'
$taskCompilerPackages=@('org.jetbrains.kotlin\kotlin-compiler-embeddable\2.0.21','org.jetbrains.kotlin\kotlin-stdlib\2.0.21','org.jetbrains.kotlin\kotlin-reflect','org.jetbrains.kotlin\kotlin-script-runtime','org.jetbrains.intellij.deps\trove4j','org.jetbrains.kotlinx\kotlinx-coroutines-core-jvm','org.jetbrains\annotations')
$taskCompilerFiles=@($taskCompilerPackages | ForEach-Object { Get-ChildItem -LiteralPath (Join-Path $taskCache $_) -Recurse -File -Filter '*.jar' -ErrorAction SilentlyContinue } | Select-Object -ExpandProperty FullName)
$taskWrapper=Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.10.2-bin'
$taskJunit=Get-ChildItem -LiteralPath $taskWrapper -Recurse -File -Filter 'junit-4.13.2.jar' | Select-Object -First 1 -ExpandProperty FullName
$taskHamcrest=Get-ChildItem -LiteralPath $taskWrapper -Recurse -File -Filter 'hamcrest-core-1.3.jar' | Select-Object -First 1 -ExpandProperty FullName
$taskRuntimeFiles=@(Get-ChildItem -LiteralPath (Join-Path $taskCache 'org.jetbrains.kotlin\kotlin-stdlib\2.0.21') -Recurse -File -Filter '*.jar' | Select-Object -ExpandProperty FullName)+@($taskJunit,$taskHamcrest,(Join-Path $taskArtifacts 'json-20240303.jar'))+@(Get-ChildItem -LiteralPath (Join-Path $taskCache 'org.jetbrains\annotations') -Recurse -File -Filter '*.jar' | Select-Object -ExpandProperty FullName)
foreach($taskFile in $taskRuntimeFiles) { if(-not(Test-Path -LiteralPath $taskFile)) { throw 'Required cached test runtime is unavailable' } }
$taskStamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')
$taskOutput=Join-Path $taskArtifacts ('coordinator-classes-'+$taskStamp)
[IO.Directory]::CreateDirectory($taskOutput) | Out-Null
$taskCompileLog=Join-Path $taskArtifacts ('coordinator-compile-'+$taskStamp+'.log')
$taskTestLog=Join-Path $taskArtifacts ('coordinator-unit-'+$taskStamp+'.log')
$taskRuntimeClasspath=$taskRuntimeFiles -join ';'
$taskSources=@(
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloNativeMusicIntent.kt'),
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloVoiceMediaCommand.kt'),
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloMusicPlayerCoordinator.kt'),
 (Join-Path $taskProject 'app\src\test\kotlin\br\com\icaroamaral\elo\EloNativeMusicIntentTest.kt'),
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloVoiceCoordinator.kt'),
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloWakeWordDecision.kt'),
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloCanonicalVoiceClient.kt'),
 (Join-Path $taskProject 'app\src\main\java\br\com\icaroamaral\elo\EloVoiceUtteranceBuffer.kt'),
 (Join-Path $taskProject 'app\src\test\kotlin\br\com\icaroamaral\elo\EloVoiceCoordinatorTest.kt'),
 (Join-Path $taskProject 'app\src\test\kotlin\br\com\icaroamaral\elo\EloCanonicalVoiceClientTest.kt'),
 (Join-Path $taskProject 'app\src\test\kotlin\br\com\icaroamaral\elo\EloVoiceUtteranceBufferTest.kt')
)
& java -Xmx384m -cp ($taskCompilerFiles -join ';') org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath $taskRuntimeClasspath -d $taskOutput @taskSources *> $taskCompileLog
$taskCompileExit=$LASTEXITCODE
if($taskCompileExit -ne 0) { Get-Content -LiteralPath $taskCompileLog -Tail 45; exit $taskCompileExit }
& java -Xmx256m -cp ($taskOutput+';'+$taskRuntimeClasspath) org.junit.runner.JUnitCore br.com.icaroamaral.elo.EloVoiceCoordinatorTest br.com.icaroamaral.elo.EloCanonicalVoiceClientTest br.com.icaroamaral.elo.EloVoiceUtteranceBufferTest br.com.icaroamaral.elo.EloNativeMusicIntentTest *> $taskTestLog
$taskTestExit=$LASTEXITCODE
Get-Content -LiteralPath $taskTestLog
[pscustomobject]@{CompileLog=$taskCompileLog;TestLog=$taskTestLog;ExitCode=$taskTestExit;AcousticEvidence=$false} | ConvertTo-Json -Compress
exit $taskTestExit

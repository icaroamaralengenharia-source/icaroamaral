$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
$taskWorkspace=Split-Path $taskProject -Parent
$taskArtifacts=Join-Path $taskWorkspace 'tmp\elo-brain-native-20261014'
$taskCache=Join-Path $env:USERPROFILE '.gradle\caches'
$taskModules=Join-Path $taskCache 'modules-2\files-2.1'
$taskCompilerPackages=@('org.jetbrains.kotlin\kotlin-compiler-embeddable\2.0.21','org.jetbrains.kotlin\kotlin-stdlib\2.0.21','org.jetbrains.kotlin\kotlin-reflect','org.jetbrains.kotlin\kotlin-script-runtime','org.jetbrains.intellij.deps\trove4j','org.jetbrains.kotlinx\kotlinx-coroutines-core-jvm','org.jetbrains\annotations')
$taskCompilerFiles=@($taskCompilerPackages | ForEach-Object { Get-ChildItem -LiteralPath (Join-Path $taskModules $_) -Recurse -File -Filter '*.jar' -ErrorAction SilentlyContinue } | Select-Object -ExpandProperty FullName)
$taskLibraries=@(Get-ChildItem -LiteralPath (Join-Path $taskCache '8.10.2\transforms') -Recurse -File -Filter 'classes.jar' | Select-Object -ExpandProperty FullName)
$taskLibraries+=@(Get-ChildItem -LiteralPath $taskModules -Directory -Filter 'androidx.*' | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Filter '*.jar' } | Where-Object { $_.FullName -notmatch 'databinding-compiler' } | Select-Object -ExpandProperty FullName)
$taskLibraries+=@($taskCompilerFiles | Where-Object { $_ -notmatch 'compiler-embeddable|reflect|trove4j|script-runtime' })
$taskWork=Join-Path $taskArtifacts 'android-build-work\app-build'
$taskLibraries+=@('C:\Android\Sdk\platforms\android-35\android.jar', (Join-Path $taskWork 'intermediates\javac\debug\compileDebugJavaWithJavac\classes'))
$taskLibraries+=@(Get-ChildItem -LiteralPath (Join-Path $taskWork 'intermediates\compile_and_runtime_not_namespaced_r_class_jar') -Recurse -File -Filter 'R.jar' | Select-Object -ExpandProperty FullName)
$taskSources=@(Get-ChildItem -LiteralPath (Join-Path $taskProject 'app\src\main\java') -Recurse -File -Filter '*.kt' | Select-Object -ExpandProperty FullName)
$taskStamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')
$taskOutput=Join-Path $taskArtifacts ('native-light-classes-'+$taskStamp)
[IO.Directory]::CreateDirectory($taskOutput) | Out-Null
$taskLog=Join-Path $taskArtifacts ('native-light-compile-'+$taskStamp+'.log')
$taskManifest=@($taskSources | ForEach-Object { @{path=$_;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash} })
& java -Xmx384m -cp ($taskCompilerFiles -join ';') org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 1.8 -classpath ($taskLibraries -join ';') -d $taskOutput @taskSources *> $taskLog
$taskExit=$LASTEXITCODE
$taskChanged=@($taskManifest | Where-Object { (Get-FileHash -LiteralPath $_.path -Algorithm SHA256).Hash -ne $_.sha256 })
if($taskChanged.Count -gt 0) { $taskExit=2 }
$taskManifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskArtifacts ('native-light-sources-'+$taskStamp+'.json')) -Encoding utf8
Get-Content -LiteralPath $taskLog -Tail 45
[ordered]@{exitCode=$taskExit;log=$taskLog;sources=$taskSources.Count;sourceChangesDuringCompile=$taskChanged.Count;androidApi=35;apkProduced=$false;installed=$false;acousticEvidence=$false} | ConvertTo-Json
exit $taskExit

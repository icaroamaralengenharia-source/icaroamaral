param([string]$Candidate,[string]$InstalledBackup,[string]$ExpectedInstalledHash='678480c1fd16b3d0f1c487f192daa48b4ee31002c7f939e028ad2f339d346104',[string]$WorkRoot)
$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
$taskWorkspace=Split-Path $taskProject -Parent
$taskArtifacts=Join-Path $taskWorkspace 'tmp\elo-brain-native-20261014'
if(-not $WorkRoot) { $WorkRoot=Join-Path $taskArtifacts 'android-build-work' }
if(-not $Candidate) { $Candidate=Join-Path $WorkRoot 'app-build\outputs\apk\debug\app-debug.apk' }
$taskInstalled=Join-Path $taskArtifacts 'installed-elo-0.4.2-v6.apk'
if($InstalledBackup) { $taskInstalled=[IO.Path]::GetFullPath($InstalledBackup) }
$taskStamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Get-EntryHash($Entry) {
 $taskStream=$Entry.Open(); $taskSha=[Security.Cryptography.SHA256]::Create()
 try { return [Convert]::ToHexString($taskSha.ComputeHash($taskStream)).ToLowerInvariant() }
 finally { $taskStream.Dispose(); $taskSha.Dispose() }
}
function Get-ApkMetadata([string]$Path) {
 $taskCert=@(& 'C:\Android\Sdk\build-tools\35.0.1\apksigner.bat' verify --print-certs $Path 2>&1)
 if($LASTEXITCODE -ne 0) { throw 'APK_SIGNATURE_INVALID' }
 $taskDigest=($taskCert | Select-String '^Signer #1 certificate SHA-256 digest: (\w+)$').Matches[0].Groups[1].Value.ToLowerInvariant()
 $taskBadging=@(& 'C:\Android\Sdk\build-tools\35.0.1\aapt2.exe' dump badging $Path 2>&1)
 if($LASTEXITCODE -ne 0) { throw 'APK_BADGING_FAILED' }
 $taskPackage=($taskBadging | Select-String "^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'").Matches[0].Groups
 $taskSdk=($taskBadging | Select-String "^(?:minSdkVersion|sdkVersion):'(\d+)'").Matches[0].Groups[1].Value
 return [ordered]@{path=[IO.Path]::GetFullPath($Path);bytes=(Get-Item -LiteralPath $Path).Length;sha256=(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant();certificateSha256=$taskDigest;package=$taskPackage[1].Value;versionCode=[int]$taskPackage[2].Value;versionName=$taskPackage[3].Value;minSdk=[int]$taskSdk;permissions=@(($taskBadging | Select-String "^uses-permission: name='([^']+)'").Matches | ForEach-Object { $_.Groups[1].Value })}
}
$taskOld=Get-ApkMetadata $taskInstalled
$taskNew=Get-ApkMetadata $Candidate
$taskOldZip=[IO.Compression.ZipFile]::OpenRead($taskInstalled)
$taskNewZip=[IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Candidate))
$taskAssets=@(); $taskModelChecks=@()
try {
 foreach($taskEntry in $taskOldZip.Entries) {
  if(-not $taskEntry.FullName.StartsWith('assets/') -or $taskEntry.FullName.StartsWith('assets/dexopt/') -or $taskEntry.FullName.EndsWith('/')) { continue }
  # Our added engine/adapter/license assets are verified separately and may change
  # with this feature. Every pre-existing ELO catalog/media asset must stay exact.
  if($taskEntry.FullName -eq 'assets/elo-native-brain.js' -or $taskEntry.FullName.StartsWith('assets/elo-wake-pt/') -or $taskEntry.FullName.StartsWith('assets/third-party/')) { continue }
  $taskReplacement=$taskNewZip.GetEntry($taskEntry.FullName)
  $taskSame=$null -ne $taskReplacement -and $taskEntry.Length -eq $taskReplacement.Length
  if($taskSame) { $taskSame=(Get-EntryHash $taskEntry) -eq (Get-EntryHash $taskReplacement) }
  $taskAssets+=@{path=$taskEntry.FullName;bytes=$taskEntry.Length;preserved=$taskSame}
 }
 $taskModelManifest=Get-Content -LiteralPath (Join-Path $taskArtifacts 'local-wake-model-files.json') -Raw | ConvertFrom-Json
 foreach($taskFile in $taskModelManifest.files) {
  $taskEntry=$taskNewZip.GetEntry('assets/elo-wake-pt/'+$taskFile.path.Replace('\','/'))
  $taskMatch=$null -ne $taskEntry -and $taskEntry.Length -eq $taskFile.bytes
  if($taskMatch) { $taskMatch=(Get-EntryHash $taskEntry) -eq $taskFile.sha256 }
  $taskModelChecks+=@{path=$taskFile.path;matches=$taskMatch}
 }
 $taskAdapter=$taskNewZip.GetEntry('assets/elo-native-brain.js')
 $taskAdapterMatches=$null -ne $taskAdapter -and (Get-EntryHash $taskAdapter) -eq (Get-FileHash -LiteralPath (Join-Path $taskProject 'app\src\main\assets\elo-native-brain.js') -Algorithm SHA256).Hash.ToLowerInvariant()
 $taskLicensesBundled=$null -ne $taskNewZip.GetEntry('assets/third-party/APACHE-2.0.txt') -and $null -ne $taskNewZip.GetEntry('assets/third-party/ELO-LOCAL-SPEECH-NOTICE.txt')
} finally { $taskOldZip.Dispose(); $taskNewZip.Dispose() }
$taskProvenance=Get-Content -LiteralPath (Join-Path $taskArtifacts 'native-baseline-provenance.json') -Raw | ConvertFrom-Json
$taskBaselineChanges=@()
foreach($taskFile in $taskProvenance.files) {
 $taskPath=Join-Path $taskProvenance.source $taskFile.path
 if(-not (Test-Path -LiteralPath $taskPath) -or (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskFile.sha256) { $taskBaselineChanges+=$taskFile.path }
}
$taskTests=@(Get-ChildItem -LiteralPath (Join-Path $WorkRoot 'app-build\test-results\testDebugUnitTest') -Filter 'TEST-*.xml' | ForEach-Object {
 [xml]$taskXml=Get-Content -LiteralPath $_.FullName
 @{name=$taskXml.testsuite.name;tests=[int]$taskXml.testsuite.tests;failures=[int]$taskXml.testsuite.failures;errors=[int]$taskXml.testsuite.errors}
})
$taskSourceFiles=@(Get-ChildItem -LiteralPath $taskProject -Recurse -File | Where-Object {
 $taskRelative=[IO.Path]::GetRelativePath($taskProject,$_.FullName)
 $taskRelative -notmatch '^(model-assets|build|\.gradle|\.kotlin)[\\/]' -and $taskRelative -notmatch '(^|[\\/])(build|\.gradle|\.kotlin)[\\/]' -and $taskRelative -ne 'local.properties' -and $_.Extension -notin @('.jks','.keystore')
} | ForEach-Object { @{path=[IO.Path]::GetRelativePath($taskProject,$_.FullName).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
# Android permits replacing the same versionCode with the same signer. Reject
# downgrades while allowing corrective V9 candidates without changing app data.
$taskSafe=$taskOld.certificateSha256 -eq $taskNew.certificateSha256 -and $taskOld.package -eq 'br.com.icaroamaral.elo' -and $taskNew.package -eq 'br.com.icaroamaral.elo' -and $taskNew.versionCode -ge $taskOld.versionCode -and $taskNew.minSdk -le 34 -and $taskOld.sha256 -eq $ExpectedInstalledHash -and @($taskAssets | Where-Object { -not $_.preserved }).Count -eq 0 -and @($taskModelChecks | Where-Object { -not $_.matches }).Count -eq 0 -and $taskAdapterMatches -and $taskLicensesBundled -and $taskBaselineChanges.Count -eq 0 -and ($taskTests | Measure-Object tests -Sum).Sum -ge 37 -and @($taskTests | Where-Object { $_.failures -gt 0 -or $_.errors -gt 0 }).Count -eq 0
$taskReport=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');installedBackup=$taskOld;candidate=$taskNew;installedAssets=$taskAssets;model=$taskModelChecks;adapterMatchesCurrentSource=$taskAdapterMatches;licensesBundled=$taskLicensesBundled;baselineSourceChanges=$taskBaselineChanges;nativeTests=$taskTests;sourceFiles=$taskSourceFiles;localUpdatePrerequisitesPass=$taskSafe;deviceSessionCheckStillRequired=$true;installed=$false;dataDeleted=$false}
$taskReportPath=Join-Path $taskArtifacts ('apk-safety-'+$taskStamp+'.json')
$taskReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $taskReportPath -Encoding utf8
[ordered]@{report=$taskReportPath;localUpdatePrerequisitesPass=$taskSafe;certificateMatches=$taskOld.certificateSha256 -eq $taskNew.certificateSha256;installedAssetCount=$taskAssets.Count;changedAssets=@($taskAssets | Where-Object { -not $_.preserved });modelFileCount=$taskModelChecks.Count;adapterMatches=$taskAdapterMatches;baselineSourceChanges=$taskBaselineChanges;candidate=$taskNew;freeSpace=[IO.DriveInfo]::new('C:\').AvailableFreeSpace} | ConvertTo-Json -Depth 6
if(-not $taskSafe) { exit 1 }

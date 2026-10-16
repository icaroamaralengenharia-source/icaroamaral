$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
$taskWorkspace=Split-Path $taskProject -Parent
$taskArtifacts=Join-Path $taskWorkspace 'tmp\elo-brain-native-20261014'
$taskDdc=[IO.Path]::GetFullPath('C:\Users\Wia Engenharia\AppData\Local\UnrealEngine\Common\DerivedDataCache')
$taskExtract=[IO.Path]::GetFullPath('C:\Android\cmdline-tools-extract\cmdline-tools')
$taskSdk=[IO.Path]::GetFullPath('C:\Android\Sdk\cmdline-tools\latest')
$taskProcesses=@(Get-CimInstance Win32_Process)
if(@($taskProcesses | Where-Object { $_.Name -match 'Unreal|UE4Editor|UE5Editor|ShaderCompile|ZenServer|ZenService|UnrealBuildTool|Uba|Swarm' -or $_.CommandLine -like '*C:\Android\cmdline-tools-extract*' }).Count -gt 0) {throw 'CACHE_OR_EXTRACTION_CONSUMER_ACTIVE'}
foreach($taskLevel in @('Process','User','Machine')) {
 foreach($taskName in @('PATH','ANDROID_HOME','ANDROID_SDK_ROOT','GRADLE_HOME')) {
  if([Environment]::GetEnvironmentVariable($taskName,$taskLevel) -like '*C:\Android\cmdline-tools-extract*'){throw 'SDK_EXTRACTION_STILL_CONFIGURED'}
 }
}
$taskRemovals=[Collections.Generic.List[object]]::new();$taskSdkProof=[Collections.Generic.List[object]]::new()
foreach($taskRoot in @($taskDdc,$taskExtract)) {
 $taskRootItem=Get-Item -LiteralPath $taskRoot
 if($taskRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'REPARSE_ROOT_REFUSED'}
 foreach($taskItem in Get-ChildItem -LiteralPath $taskRoot -Recurse -Force) {
  $taskFull=[IO.Path]::GetFullPath($taskItem.FullName)
  if(-not $taskFull.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'OUTSIDE_APPROVED_TARGET'}
  if($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'REPARSE_CHILD_REFUSED'}
  if($taskItem.PSIsContainer){continue}
  if($taskRoot -eq $taskDdc) {
   # Only compiled Unreal .udd payloads. Preserve cache metadata (.dat), Zen,
   # editor settings, logs, source .uasset files and all projects.
   if($taskItem.Extension -ne '.udd'){continue}
   $taskRemovals.Add(@{path=$taskFull;bytes=$taskItem.Length;kind='UNREAL_DERIVED_DATA_CACHE_UDD'})
   if($taskRemovals.Count % 5000 -eq 0){Write-Output ('Validated derived cache files: '+$taskRemovals.Count)}
  } else {
   $taskRelative=[IO.Path]::GetRelativePath($taskExtract,$taskFull)
   $taskInstalled=Join-Path $taskSdk $taskRelative
   if(-not(Test-Path -LiteralPath $taskInstalled -PathType Leaf)){throw 'SDK_COPY_MISSING'}
   $taskHash=(Get-FileHash -LiteralPath $taskFull -Algorithm SHA256).Hash
   if((Get-FileHash -LiteralPath $taskInstalled -Algorithm SHA256).Hash -ne $taskHash){throw 'SDK_COPY_MISMATCH'}
   $taskRemovals.Add(@{path=$taskFull;bytes=$taskItem.Length;kind='DUPLICATE_SDK_INSTALLER_EXTRACTION'})
   $taskSdkProof.Add(@{path=$taskInstalled;sha256=$taskHash})
  }
 }
}
Write-Output ('Approved cache/extraction file candidates: '+$taskRemovals.Count)
foreach($taskFile in $taskRemovals | Where-Object { $_.kind -eq 'DUPLICATE_SDK_INSTALLER_EXTRACTION' }) {
 $taskProbe=[IO.File]::Open($taskFile.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
 $taskProbe.Dispose()
}
$taskDrive=[IO.DriveInfo]::new('C:\')
$taskStamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')
$taskReport=Join-Path $taskArtifacts ('development-cache-cleanup-'+$taskStamp+'.json')
$taskRecord=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');spaceBefore=$taskDrive.AvailableFreeSpace;reviewedTargets=@($taskDdc,$taskExtract);disposableCacheDocumentation='https://dev.epicgames.com/documentation/en-us/unreal-engine/using-derived-data-cache-in-unreal-engine';activeConsumers=0;sdkExclusiveReadProbesPassed=$true;sourceProjectsPreserved=$true;sdkInstalledCopies=$taskSdkProof.ToArray();approvedFiles=$taskRemovals.ToArray();deletedFiles=0;deletedBytes=0;completed=$false;backupsDeleted=$false;phoneDataTouched=$false}
# Persist exact approved file list before deleting any cache payload.
$taskRecord | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskReport -Encoding utf8
Write-Output ('Deletion manifest saved: '+$taskReport)
foreach($taskFile in $taskRemovals) {
 Remove-Item -LiteralPath $taskFile.path -ErrorAction Stop
 $taskRecord.deletedFiles++;$taskRecord.deletedBytes+=$taskFile.bytes
 if($taskRecord.deletedFiles % 5000 -eq 0){Write-Output ('Removed verified cache files: '+$taskRecord.deletedFiles)}
}
foreach($taskProof in $taskSdkProof) {if((Get-FileHash -LiteralPath $taskProof.path -Algorithm SHA256).Hash -ne $taskProof.sha256){throw 'INSTALLED_SDK_CHANGED'}}
$taskRecord.completed=$true;$taskRecord.spaceAfter=$taskDrive.AvailableFreeSpace
$taskRecord | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskReport -Encoding utf8
[ordered]@{report=$taskReport;spaceBefore=$taskRecord.spaceBefore;verifiedRegenerableBytesRemoved=$taskRecord.deletedBytes;filesRemoved=$taskRecord.deletedFiles;spaceAfter=$taskRecord.spaceAfter;installedSdkVerified=$true;sourceCodePreserved=$true;backupsPreserved=$true;userDataDeleted=$false} | ConvertTo-Json

[CmdletBinding()]
param(
    [string]$ApkPath = "",
    [string]$Package = "br.com.icaroamar.elo",
    [switch]$Stress
)

$ErrorActionPreference = "Stop"
$script:StartedAt = Get-Date
$reportRoot = Join-Path $PSScriptRoot ("test-results\physical-smoke-" + $script:StartedAt.ToString("yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
$logPath = Join-Path $reportRoot "adb.log"
$adb = if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME "platform-tools\adb.exe" } else { "C:\Android\Sdk\platform-tools\adb.exe" }
if (-not (Test-Path -LiteralPath $adb -PathType Leaf)) { throw "adb não encontrado: $adb" }
$errors = [System.Collections.Generic.List[string]]::new()
$results = [ordered]@{}

function Invoke-Adb {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = & $adb @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $output | Out-File -FilePath $logPath -Append -Encoding utf8
    if ($exitCode -ne 0) {
        throw "adb $($Arguments -join ' ') failed with exit code $($exitCode): $output"
    }
    return ($output -join [Environment]::NewLine)
}

function Record-Check {
    param([string]$Name, [bool]$Passed, [string]$Evidence)
    $results[$Name] = [ordered]@{ passed = $Passed; evidence = $Evidence }
    if (-not $Passed) { $errors.Add($Name) }
}

function Measure-Launch {
    param([string]$Mode)
    $start = Get-Date
    $output = Invoke-Adb @("shell", "am", "start", "-W", "-n", "$Package/.MainActivity")
    $elapsed = ((Get-Date) - $start).TotalMilliseconds
    $total = [regex]::Match($output, "TotalTime:\s*(\d+)").Groups[1].Value
    return [ordered]@{ mode = $Mode; wallMs = [math]::Round($elapsed); amStartTotalMs = if ($total) { [int]$total } else { $null } }
}

function Test-LogHealth {
    $log = Invoke-Adb @("logcat", "-d", "-t", "250")
    $fatal = [regex]::Matches($log, "(?im)FATAL EXCEPTION|ANR in|route_exception").Count
    Record-Check "crash-anr-route-exception" ($fatal -eq 0) "matches=$fatal"
    $log | Out-File (Join-Path $reportRoot "logcat-tail.txt") -Encoding utf8
}

try {
    $devices = Invoke-Adb @("devices")
    $connected = ($devices -split [Environment]::NewLine | Where-Object { $_ -match "\tdevice$" }).Count
    Record-Check "adb-device" ($connected -ge 1) $devices
    if ($connected -lt 1) { throw "Nenhum aparelho físico em estado device." }

    $packageDump = Invoke-Adb @("shell", "dumpsys", "package", $Package)
    Record-Check "package-correct" ($packageDump -match [regex]::Escape($Package)) $Package

    if ($ApkPath) {
        if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) { throw "APK não encontrado: $ApkPath" }
        $before = Invoke-Adb @("shell", "pm", "path", $Package)
        Invoke-Adb @("install", "-r", "--no-incremental", $ApkPath) | Out-Null
        $after = Invoke-Adb @("shell", "pm", "path", $Package)
        Record-Check "install-r" ($after -match [regex]::Escape($Package)) ("before=" + $before + [Environment]::NewLine + "after=" + $after)
    }

    $results["launch-online"] = Measure-Launch "online"
    Invoke-Adb @("shell", "input", "keyevent", "KEYCODE_HOME") | Out-Null
    Invoke-Adb @("shell", "am", "force-stop", $Package) | Out-Null
    $results["cold-start-online"] = Measure-Launch "online-cold"
    Invoke-Adb @("shell", "am", "force-stop", $Package) | Out-Null
    $results["reopen-online"] = Measure-Launch "online-reopen"

    $results["storage"] = Invoke-Adb @("shell", "df", "-h", "/data")
    $results["online-local-routing-fixtures"] = @(
        "Que dia é hoje?",
        "Que dia é amanhã?",
        "Que dia foi ontem?",
        "125 x 8",
        "10% de 995 milhões",
        "e dividido por 2?",
        "O que é impermeabilização?"
    )

    try {
        Invoke-Adb @("shell", "cmd", "connectivity", "airplane-mode", "enable") | Out-Null
        Start-Sleep -Seconds 2
        Invoke-Adb @("shell", "am", "force-stop", $Package) | Out-Null
        $results["cold-start-offline"] = Measure-Launch "offline-cold"
        Invoke-Adb @("shell", "am", "force-stop", $Package) | Out-Null
        $results["reopen-offline"] = Measure-Launch "offline-reopen"
        $results["offline-local-routing-fixtures"] = @(
            "Bom dia",
            "Que dia é hoje?",
            "Que dia é amanhã?",
            "Que dia foi ontem?",
            "125 x 8",
            "15% de 200",
            "10% de 995 milhões",
            "e dividido por 2?",
            "O que é impermeabilização?",
            "Toque Für Elise",
            "pause",
            "continue",
            "parar",
            "próxima",
            "anterior"
        )
    } finally {
        Invoke-Adb @("shell", "cmd", "connectivity", "airplane-mode", "disable") | Out-Null
    }

    $results["lifecycle"] = @("portrait", "landscape", "portrait", "force-stop", "reopen")
    Invoke-Adb @("shell", "settings", "put", "system", "accelerometer_rotation", "0") | Out-Null
    Invoke-Adb @("shell", "settings", "put", "system", "user_rotation", "1") | Out-Null
    Invoke-Adb @("shell", "settings", "put", "system", "user_rotation", "0") | Out-Null
    Invoke-Adb @("shell", "am", "force-stop", $Package) | Out-Null
    Invoke-Adb @("shell", "am", "start", "-n", "$Package/.MainActivity") | Out-Null

    if ($Stress) {
        $results["stress-warning"] = "Opt-in requested; deterministic UI input is device-layout dependent."
        for ($i = 1; $i -le 50; $i++) {
            Invoke-Adb @("shell", "settings", "put", "system", "user_rotation", ($i % 2)) | Out-Null
        }
        for ($i = 1; $i -le 20; $i++) {
            Invoke-Adb @("shell", "am", "force-stop", $Package) | Out-Null
            Invoke-Adb @("shell", "am", "start", "-n", "$Package/.MainActivity") | Out-Null
        }
    }

    Test-LogHealth
} catch {
    $errors.Add($_.Exception.Message)
} finally {
    $summary = [ordered]@{
        package = $Package
        startedAt = $script:StartedAt.ToUniversalTime().ToString("o")
        finishedAt = (Get-Date).ToUniversalTime().ToString("o")
        passed = ($errors.Count -eq 0)
        failures = @($errors)
        checks = $results
        note = "Semantic chat assertions and chooser/report E2E require selectors/fixtures specific to the installed WebView; raw evidence is retained in this directory."
    }
    $summary | ConvertTo-Json -Depth 8 | Out-File (Join-Path $reportRoot "physical-smoke.json") -Encoding utf8
    Write-Host ($summary | ConvertTo-Json -Depth 8)
}
if ($errors.Count -gt 0) { exit 1 }

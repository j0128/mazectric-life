$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$html = Join-Path $PSScriptRoot "index.html"
if (-not (Test-Path $html)) {
  Write-Host "Missing index.html"
  exit 1
}
$path = (Resolve-Path $html).Path
$uri = (New-Object System.Uri $path).AbsoluteUri

$candidates = @()
if ($env:ProgramFiles) {
  $candidates += (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")
}
if (${env:ProgramFiles(x86)}) {
  $candidates += (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
}
if ($env:ProgramFiles) {
  $candidates += (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe")
}
if ($env:LocalAppData) {
  $candidates += (Join-Path $env:LocalAppData "Google\Chrome\Application\chrome.exe")
}

$exe = $null
foreach ($c in $candidates) {
  if ($c -and (Test-Path $c)) {
    $exe = $c
    break
  }
}

if (-not $exe) {
  Write-Host "Edge/Chrome not found; opening default browser."
  Start-Process $html
  exit 0
}

$profile = Join-Path $env:TEMP "posa-life-window-v41"
if (-not (Test-Path $profile)) {
  New-Item -ItemType Directory -Path $profile | Out-Null
}

$launchArgs = @(
  "--app=$uri",
  "--user-data-dir=$profile",
  "--window-size=1400,900",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion"
)

Start-Process -FilePath $exe -ArgumentList $launchArgs
Write-Host "Launched $exe"
Write-Host $uri
exit 0

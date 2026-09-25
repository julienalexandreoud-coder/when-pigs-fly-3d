# Builds dist/when-pigs-fly-crazygames.zip with only what the game needs at runtime.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $root 'dist\when-pigs-fly'
$zip = Join-Path $root 'dist\when-pigs-fly-crazygames.zip'

if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $root 'index.html') $stage
Copy-Item -Recurse (Join-Path $root 'css') $stage
Copy-Item -Recurse (Join-Path $root 'js') $stage

if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
$size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
$files = (Get-ChildItem -Recurse -File $stage).Count
Write-Output "Packed $files files into $zip ($size KB)"

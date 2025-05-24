# PowerShell script to create symlink for GLOG2D6 Foundry system
# Run as Administrator

param(
    [string]$FoundryDataPath = "",
    [switch]$Remove
)

$SystemName = "glog2d6"
$CurrentDir = Get-Location

# Common Foundry data paths
$CommonPaths = @(
    "$env:LOCALAPPDATA\FoundryVTT\Data\systems",
    "$env:APPDATA\FoundryVTT\Data\systems",
    "C:\Users\$env:USERNAME\AppData\Local\FoundryVTT\Data\systems",
    "D:\FoundryVTT\Data\systems",
    "C:\FoundryVTT\Data\systems"
)

function Find-FoundryPath {
    if ($FoundryDataPath -and (Test-Path $FoundryDataPath)) {
        return $FoundryDataPath
    }

    foreach ($path in $CommonPaths) {
        if (Test-Path $path) {
            Write-Host "Found Foundry systems directory: $path" -ForegroundColor Green
            return $path
        }
    }

    return $null
}

function Test-AdminRights {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check if running as admin
if (-not (Test-AdminRights)) {
    Write-Host "This script needs to run as Administrator to create symlinks." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

# Find Foundry systems directory
$SystemsPath = Find-FoundryPath

if (-not $SystemsPath) {
    Write-Host "Could not find Foundry systems directory!" -ForegroundColor Red
    Write-Host "Please specify the path manually:" -ForegroundColor Yellow
    Write-Host "  .\setup-symlink.ps1 -FoundryDataPath 'C:\Users\forev\AppData\Local\FoundryVTT\Data\systems'" -ForegroundColor Yellow
    exit 1
}

$TargetPath = Join-Path $SystemsPath $SystemName

# Remove existing symlink if requested
if ($Remove) {
    if (Test-Path $TargetPath) {
        Remove-Item $TargetPath -Force -Recurse
        Write-Host "Removed symlink: $TargetPath" -ForegroundColor Green
    } else {
        Write-Host "No symlink found to remove." -ForegroundColor Yellow
    }
    exit 0
}

# Check if target already exists
if (Test-Path $TargetPath) {
    Write-Host "Target already exists: $TargetPath" -ForegroundColor Yellow
    $response = Read-Host "Remove existing and create new symlink? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Remove-Item $TargetPath -Force -Recurse
    } else {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Create the symlink
try {
    New-Item -ItemType SymbolicLink -Path $TargetPath -Target $CurrentDir -Force | Out-Null
    Write-Host "Successfully created symlink!" -ForegroundColor Green
    Write-Host "Source: $CurrentDir" -ForegroundColor Cyan
    Write-Host "Target: $TargetPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now:" -ForegroundColor White
    Write-Host "1. Restart Foundry VTT" -ForegroundColor White
    Write-Host "2. Create a new world with the 'GLOG 2d6' system" -ForegroundColor White
    Write-Host "3. Any changes to files in this directory will be immediately available in Foundry" -ForegroundColor White
} catch {
    Write-Host "Failed to create symlink: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure you're running as Administrator and the target directory doesn't exist." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To remove the symlink later, run:" -ForegroundColor Gray
Write-Host "  .\setup-symlink.ps1 -Remove" -ForegroundColor Gray

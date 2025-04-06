$SourcePath = Join-Path -Path $PWD -ChildPath "dist\glog2d6"
$FoundryDataPath = Join-Path -Path $env:LOCALAPPDATA -ChildPath "FoundryVTT\Data\systems\glog2d6"

# Check if the destination already exists
if (Test-Path $FoundryDataPath) {
    Write-Host "Destination path already exists. Removing it first..."
    Remove-Item -Path $FoundryDataPath -Force -Recurse
}

# Create the parent directories if they don't exist
$ParentDir = Split-Path -Path $FoundryDataPath -Parent
if (-not (Test-Path $ParentDir)) {
    New-Item -ItemType Directory -Path $ParentDir -Force
}

# Create the symbolic link
New-Item -ItemType Junction -Path $FoundryDataPath -Target $SourcePath

# Check if the link was created successfully
if (Test-Path $FoundryDataPath) {
    Write-Host "Symbolic link created successfully!"
    Write-Host "Source: $SourcePath"
    Write-Host "Destination: $FoundryDataPath"
} else {
    Write-Host "Failed to create symbolic link. Make sure you're running as Administrator."
}

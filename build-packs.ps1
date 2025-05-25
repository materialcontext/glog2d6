# Simple pack builder for GLOG 2d6
Write-Host "Building content packs for GLOG 2d6..." -ForegroundColor Green

# Ensure packs directory exists
if (-not (Test-Path "packs")) {
    New-Item -ItemType Directory -Path "packs"
}

# Copy any manually created .db files or create empty ones
$packFiles = @("basic-equipment.db", "starter-weapons.db", "armor-sets.db", "sample-characters.db", "monsters.db")

foreach ($pack in $packFiles) {
    $packPath = "packs\$pack"
    if (-not (Test-Path $packPath)) {
        New-Item -ItemType File -Path $packPath
        Write-Host "Created empty pack: $pack" -ForegroundColor Yellow
    }
}

Write-Host "Pack setup complete!" -ForegroundColor Green

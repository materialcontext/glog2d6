# Build Basic Weapons Pack for GLOG 2d6
Write-Host "Building Basic Weapons Pack..." -ForegroundColor Green

# Ensure directories exist
if (-not (Test-Path "content")) {
    New-Item -ItemType Directory -Path "content"
}
if (-not (Test-Path "packs")) {
    New-Item -ItemType Directory -Path "packs"
}

# Function to generate a simple ID
function New-ItemId {
    return "item" + (Get-Random -Minimum 100000 -Maximum 999999)
}

# Read the weapons content file
$contentPath = "content\basic-weapons.json"
if (-not (Test-Path $contentPath)) {
    Write-Host "Content file not found: $contentPath" -ForegroundColor Red
    Write-Host "Please create the content file first." -ForegroundColor Yellow
    exit 1
}

$content = Get-Content $contentPath -Raw | ConvertFrom-Json

# Build the weapons pack
$packPath = "packs\basic-weapons.db"
$packItems = @()
$sortOrder = 100

# Process weapons
foreach ($weapon in $content.weapons) {
    $item = @{
        "_id" = New-ItemId
        "name" = $weapon.name
        "type" = $weapon.type
        "img" = $weapon.img
        "system" = $weapon.system
        "folder" = $null
        "sort" = $sortOrder
    }
    $packItems += $item
    $sortOrder += 100
}

# Process ammunition
foreach ($ammo in $content.ammunition) {
    $item = @{
        "_id" = New-ItemId
        "name" = $ammo.name
        "type" = $ammo.type
        "img" = $ammo.img
        "system" = $ammo.system
        "folder" = $null
        "sort" = $sortOrder
    }
    $packItems += $item
    $sortOrder += 100
}

# Write the pack file (each item on its own line as JSON)
$packLines = @()
foreach ($item in $packItems) {
    $packLines += ($item | ConvertTo-Json -Compress -Depth 10)
}

$packLines | Out-File -FilePath $packPath -Encoding UTF8

Write-Host "Created $packPath with $($packItems.Count) items:" -ForegroundColor Green

# List the items created
foreach ($item in $packItems) {
    $size = if ($item.system.size) { "($($item.system.size))" } else { "" }
    $damage = if ($item.system.damage) { "- $($item.system.damage) damage" } else { "" }
    Write-Host "  - $($item.name) $size $damage" -ForegroundColor Cyan
}

Write-Host "`nDon't forget to update your system.json with the pack definition!" -ForegroundColor Yellow

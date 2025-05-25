# Build Basic Armor Pack for GLOG 2d6
Write-Host "Building Basic Armor Pack..." -ForegroundColor Green

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

# Read the armor content file
$contentPath = "content\basic-armor.json"
if (-not (Test-Path $contentPath)) {
    Write-Host "Content file not found: $contentPath" -ForegroundColor Red
    Write-Host "Please create the content file first." -ForegroundColor Yellow
    exit 1
}

$content = Get-Content $contentPath -Raw | ConvertFrom-Json

# Build the armor pack
$packPath = "packs\basic-armor.db"
$packItems = @()
$sortOrder = 100

# Process armor pieces
foreach ($armor in $content.armor) {
    $item = @{
        "_id" = New-ItemId
        "name" = $armor.name
        "type" = $armor.type
        "img" = $armor.img
        "system" = $armor.system
        "folder" = $null
        "sort" = $sortOrder
    }
    $packItems += $item
    $sortOrder += 100
}

# Process shields
foreach ($shield in $content.shields) {
    $item = @{
        "_id" = New-ItemId
        "name" = $shield.name
        "type" = $shield.type
        "img" = $shield.img
        "system" = $shield.system
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
    $type = if ($item.system.type) { "($($item.system.type))" } else { "(shield)" }
    $bonus = "+$($item.system.armorBonus) AC"
    $penalty = if ($item.system.encumbrancePenalty -gt 0) { ", $($item.system.encumbrancePenalty) encumbrance" } else { "" }
    Write-Host "  - $($item.name) $type - $bonus$penalty" -ForegroundColor Cyan
}

Write-Host "`nDon't forget to update your system.json with the pack definition!" -ForegroundColor Yellow

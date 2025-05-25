# Build Basic Classes Pack for GLOG 2d6
Write-Host "Building Basic Classes Pack..." -ForegroundColor Green

# Ensure directories exist
if (-not (Test-Path "content")) {
    New-Item -ItemType Directory -Path "content"
}
if (-not (Test-Path "packs")) {
    New-Item -ItemType Directory -Path "packs"
}

# Function to generate a simple ID
function New-ItemId {
    return "class" + (Get-Random -Minimum 100000 -Maximum 999999)
}

# Read the classes content file
$contentPath = "content\basic-classes.json"
if (-not (Test-Path $contentPath)) {
    Write-Host "Content file not found: $contentPath" -ForegroundColor Red
    Write-Host "Please create the content file first." -ForegroundColor Yellow
    exit 1
}

$content = Get-Content $contentPath -Raw | ConvertFrom-Json

# Build the classes pack
$packPath = "packs\basic-classes.db"
$packItems = @()
$sortOrder = 100

# Process classes - we'll create them as gear type items to store the class data
foreach ($class in $content.classes) {
    $item = @{
        "_id" = New-ItemId
        "name" = $class.name
        "type" = "gear"  # Use gear type since it's defined in your system
        "img" = "icons/sundries/scrolls/scroll-plain.webp"
        "system" = @{
            "startingEquipment" = $class.startingEquipment
            "features" = $class.features
            "description" = "Class: $($class.name)"
            "category" = "class"
            "slots" = 0
        }
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

Write-Host "Created $packPath with $($packItems.Count) classes:" -ForegroundColor Green

# List the classes created
foreach ($item in $packItems) {
    $level0Features = $item.system.features.'level-0'
    Write-Host "  - $($item.name)" -ForegroundColor Cyan
    Write-Host "    Level-0: $($level0Features.Substring(0, [Math]::Min(60, $level0Features.Length)))..." -ForegroundColor Gray
}

Write-Host "`nClasses pack built successfully!" -ForegroundColor Green
Write-Host "Don't forget to update your system.json and character sheet!" -ForegroundColor Yellow

Write-Host "Rescanning disks using diskpart..." -ForegroundColor Cyan
$diskpartScript = "rescan"
$diskpartScript | diskpart
Write-Host "Disk rescan completed." -ForegroundColor Green

# Display current disk information
Write-Host "`nCurrent Disk Information:" -ForegroundColor Cyan
Get-Disk | Format-Table -AutoSize

exit 0 
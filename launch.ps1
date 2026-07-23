# launch.ps1 - Orizo Bills Desktop Launcher
$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host "   Orizo Bills -- Starting Tauri App"    -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""

# Reload PATH so cargo is found
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH","User")    + ";" +
            "$env:USERPROFILE\.cargo\bin"

# Check cargo
$cv = cargo --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Rust: $cv" -ForegroundColor Green
} else {
    Write-Host "  [WARN] cargo not found - Tauri build may fail" -ForegroundColor Yellow
}

# Clear stale processes on ports 5000 and 3000
# Match ":PORT" followed by whitespace or end-of-token to catch both IPv4 and IPv6
foreach ($port in @(5000, 3000)) {
    $killed = @()
    $lines = netstat -ano 2>$null | Select-String ":$port\b" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $pid_ = ($line.ToString().Trim() -split '\s+')[-1]
        if ($pid_ -match '^\d+$' -and $pid_ -ne '0' -and $killed -notcontains $pid_) {
            $proc = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
            if ($proc) {
                $null = & taskkill /F /PID $pid_ 2>&1
                $killed += $pid_
                Write-Host "  [WARN] Cleared $($proc.Name) (PID $pid_) on port $port" -ForegroundColor Yellow
            }
        }
    }
}

Start-Sleep -Milliseconds 800

# Launch
Write-Host ""
Write-Host "  Starting Tauri dev window..." -ForegroundColor Cyan
Write-Host "  Backend starts automatically on port 5000" -ForegroundColor Cyan
Write-Host "  First Rust compile: 2-4 min  |  After that: ~5 sec" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""

Set-Location $ROOT
& npx tauri dev

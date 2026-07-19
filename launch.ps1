# =============================================================
# launch.ps1  —  Orizo Bills Desktop Launcher (Tauri)
#
# 1. Reloads PATH so cargo/rustc are found
# 2. Clears any stale processes on ports 5000 / 3000
# 3. Runs: npx tauri dev
#
# What happens inside Tauri dev:
#   - beforeDevCommand = "npm run dev:vite"
#       → Vite starts on :3000
#       → vite-plugin-backend auto-starts Fastify on :5000
#         (DB erp_system is created, tables pushed, branch seeded)
#   - Rust binary compiles (2-4 min first time, ~5 s after)
#   - Native Tauri window opens — no browser needed
#
# Usage:  npm run dev
# =============================================================

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Info($m) { Write-Host "  $m" -ForegroundColor Cyan   }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Err($m)  { Write-Host "  [ERR] $m" -ForegroundColor Red }

Write-Host ""
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host "   Orizo Bills — Starting Tauri App" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Reload PATH so cargo/rustc are always found ───────────
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH","User")    + ";" +
            "$env:USERPROFILE\.cargo\bin"

# Verify cargo
try {
    $cv = cargo --version 2>&1
    Ok "Rust: $cv"
} catch {
    Err "cargo not found. Install Rust from https://rustup.rs"
    exit 1
}

# ── 2. Kill stale processes on ports 3000 and 5000 ──────────
foreach ($port in @(5000, 3000)) {
    $hits = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
    foreach ($hit in $hits) {
        $pid_ = ($hit.ToString().Trim() -split '\s+')[-1]
        if ($pid_ -match '^\d+$' -and $pid_ -ne '0') {
            taskkill /F /PID $pid_ 2>$null | Out-Null
            Warn "Cleared stale PID $pid_ on port $port"
        }
    }
}
Start-Sleep -Milliseconds 500

# ── 3. Launch Tauri (Vite + backend start automatically) ─────
Info "Launching Tauri window..."
Info "Backend (Fastify + MySQL erp_system) starts automatically."
Info "First Rust compile: 2-4 min.  Subsequent runs: ~5 sec."
Write-Host ""

Set-Location $ROOT
npx tauri dev

# Starts the Elevra.ai API on http://localhost:8000 (the web app's Admin > Users, AI summaries, assistant,
# simulator and mock interview need it). Run from the repository root:   .\run-api.ps1
# First run creates a virtual environment and installs the dependencies (a few minutes); later runs start at once.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env")) {
    Write-Host "Missing .env in the repository root. Copy .env.example to .env and fill in the Supabase, Gemini and ElevenLabs values." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating the Python environment (first run only)..." -ForegroundColor Cyan
    python -m venv .venv
}
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

# reinstall only when requirements.txt changed
$stamp = ".venv\requirements.stamp"
$hash = (Get-FileHash "backend\requirements.txt").Hash
if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $hash) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & $py -m pip install --quiet --upgrade pip
    & $py -m pip install --quiet -r "backend\requirements.txt"
    if ($LASTEXITCODE -ne 0) { Write-Host "Dependency install failed." -ForegroundColor Red; exit 1 }
    Set-Content -Path $stamp -Value $hash
}

# the what-if endpoint imports the scoring engine from pipeline/, so it must be on the path
$env:PYTHONPATH = (Join-Path $PSScriptRoot "pipeline") + ";" + (Join-Path $PSScriptRoot "backend")
if (-not $env:ALLOWED_ORIGINS) { $env:ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3001" }

Write-Host ""
Write-Host "API starting on http://localhost:8000   (check: http://localhost:8000/health should show {""ok"":true})" -ForegroundColor Green
Write-Host "Leave this window open while you use the app. Press Ctrl+C to stop." -ForegroundColor Green
Set-Location -Path "backend"
$ErrorActionPreference = "Continue"   # uvicorn logs to stderr; that is normal, not an error
& $py -m uvicorn main:app --host 127.0.0.1 --port 8000

$ErrorActionPreference = "Stop"

$line = Get-Content -LiteralPath ".env.local" | Where-Object { $_ -match "^NEXT_PUBLIC_SUPABASE_URL=" } | Select-Object -First 1
if (-not $line) { throw "NEXT_PUBLIC_SUPABASE_URL not found in .env.local" }

$url = ($line -replace "^NEXT_PUBLIC_SUPABASE_URL=", "").Trim().Trim('"')
$ref = ([uri]$url).Host.Split(".")[0]
Write-Output $ref


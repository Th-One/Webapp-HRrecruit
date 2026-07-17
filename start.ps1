# HRregister - static file + JSON API (PowerShell)
param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Public = Join-Path $Root 'public'
$DataDir = Join-Path $Root 'data'
$DataFile = Join-Path $DataDir 'applications.json'
$GeneratedDir = Join-Path $Root 'generated'
$Generator = Join-Path $Root 'generate_f06.py'
$PythonCandidates = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
  'python.exe'
)

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }
if (-not (Test-Path $DataFile)) { Set-Content -Path $DataFile -Value '[]' -Encoding UTF8 }
if (-not (Test-Path $GeneratedDir)) { New-Item -ItemType Directory -Path $GeneratedDir | Out-Null }

function Read-Apps {
  $raw = Get-Content -LiteralPath $DataFile -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
  return @(ConvertFrom-Json -InputObject $raw)
}

function Write-Apps($list) {
  $json = $list | ConvertTo-Json -Depth 30 -Compress:$false
  if ($null -eq $json) { $json = '[]' }
  if ($list.Count -eq 1 -and -not $json.TrimStart().StartsWith('[')) {
    $json = '[' + $json + ']'
  }
  [System.IO.File]::WriteAllText($DataFile, $json, [System.Text.UTF8Encoding]::new($false))
}

function Send-Json($res, $obj, $code = 200) {
  $json = if ($null -eq $obj) { 'null' } else { $obj | ConvertTo-Json -Depth 30 }
  if ($obj -is [System.Array] -and $obj.Count -eq 1 -and -not $json.TrimStart().StartsWith('[')) {
    $json = '[' + $json + ']'
  }
  if ($obj -is [System.Array] -and $obj.Count -eq 0) { $json = '[]' }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $res.StatusCode = $code
  $res.ContentType = 'application/json; charset=utf-8'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

function Send-Text($res, $text, $code, $contentType) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $res.StatusCode = $code
  $res.ContentType = $contentType
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

function Send-Download($res, $path, $downloadName, $contentType, $disposition = 'attachment') {
  $bytes = [IO.File]::ReadAllBytes($path)
  $encodedName = [Uri]::EscapeDataString($downloadName)
  $res.StatusCode = 200
  $res.ContentType = $contentType
  $res.Headers['Content-Disposition'] = "$disposition; filename*=UTF-8''$encodedName"
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

function Find-Python {
  foreach ($candidate in $PythonCandidates) {
    if ([IO.Path]::IsPathRooted($candidate)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    } else {
      $command = Get-Command $candidate -ErrorAction SilentlyContinue
      if ($null -ne $command) { return $command.Source }
    }
  }
  throw 'ไม่พบ Python สำหรับสร้างเอกสาร F06-005'
}

function Get-Mime($path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.js'   { 'application/javascript; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.svg'  { 'image/svg+xml' }
    '.ico'  { 'image/x-icon' }
    default { 'application/octet-stream' }
  }
}

function Read-Body($req) {
  $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
  try { return $reader.ReadToEnd() } finally { $reader.Close() }
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Cannot bind $prefix - try: .\start.ps1 -Port 3001"
  throw
}

Write-Host "HRregister running at $prefix"
Write-Host "Press Ctrl+C to stop"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    try {
      if ($req.HttpMethod -eq 'POST' -and $path -eq '/api/f06/preview') {
        $token = [guid]::NewGuid().ToString('N')
        $input = Join-Path $GeneratedDir "$token-preview.json"
        $output = Join-Path $GeneratedDir "$token-preview.pdf"
        try {
          $body = Read-Body $req
          if ([string]::IsNullOrWhiteSpace($body)) { throw 'ไม่มีข้อมูลสำหรับสร้างตัวอย่าง' }
          ConvertFrom-Json $body | Out-Null
          [IO.File]::WriteAllText($input, $body, [Text.UTF8Encoding]::new($false))
          $python = Find-Python
          $generatorOutput = & $python $Generator --data $input --output $output 2>&1
          if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output -PathType Leaf)) {
            throw "สร้างตัวอย่าง PDF ไม่สำเร็จ: $($generatorOutput -join ' ')"
          }
          Send-Download $res $output 'F06-005-preview.pdf' 'application/pdf' 'inline'
        } finally {
          Remove-Item -LiteralPath $input, $output -Force -ErrorAction SilentlyContinue
        }
        continue
      }

      if ($path.StartsWith('/api/applications')) {
        $apps = [System.Collections.Generic.List[object]]::new()
        foreach ($a in (Read-Apps)) { $apps.Add($a) }

        if ($req.HttpMethod -eq 'GET' -and $path -match '^/api/applications/([^/]+)/f06\.pdf$') {
          $id = $Matches[1]
          $item = $apps | Where-Object { $_.id -eq $id } | Select-Object -First 1
          if ($null -eq $item) { Send-Json $res @{ error = 'not found' } 404; continue }
          $python = Find-Python
          $output = Join-Path $GeneratedDir "$id-F06-005.pdf"
          $generatorOutput = & $python $Generator --data $DataFile --id $id --output $output 2>&1
          if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output -PathType Leaf)) {
            throw "สร้าง PDF ไม่สำเร็จ: $($generatorOutput -join ' ')"
          }
          $disposition = if ($req.QueryString['inline'] -eq '1') { 'inline' } else { 'attachment' }
          Send-Download $res $output "F06-005-$id.pdf" 'application/pdf' $disposition
          continue
        }

        if ($req.HttpMethod -eq 'GET' -and $path -eq '/api/applications') {
          $sorted = @($apps | Sort-Object { $_.updatedAt } -Descending)
          Send-Json $res $sorted
          continue
        }

        if ($req.HttpMethod -eq 'GET' -and $path -match '^/api/applications/([^/]+)$') {
          $id = $Matches[1]
          $item = $apps | Where-Object { $_.id -eq $id } | Select-Object -First 1
          if ($null -eq $item) { Send-Json $res @{ error = 'not found' } 404; continue }
          Send-Json $res $item
          continue
        }

        if ($req.HttpMethod -eq 'POST' -and $path -eq '/api/applications') {
          $body = Read-Body $req
          $data = if ([string]::IsNullOrWhiteSpace($body)) { @{} } else { ConvertFrom-Json $body }
          $now = (Get-Date).ToUniversalTime().ToString('o')
          $record = [pscustomobject]@{
            id = [guid]::NewGuid().ToString()
            createdAt = $now
            updatedAt = $now
            status = 'submitted'
            data = $data
          }
          $apps.Add($record)
          Write-Apps $apps.ToArray()
          Send-Json $res $record 201
          continue
        }

        if ($req.HttpMethod -eq 'PUT' -and $path -match '^/api/applications/([^/]+)$') {
          $id = $Matches[1]
          $idx = -1
          for ($i = 0; $i -lt $apps.Count; $i++) {
            if ($apps[$i].id -eq $id) { $idx = $i; break }
          }
          if ($idx -lt 0) { Send-Json $res @{ error = 'not found' } 404; continue }
          $body = Read-Body $req
          $data = if ([string]::IsNullOrWhiteSpace($body)) { @{} } else { ConvertFrom-Json $body }
          $old = $apps[$idx]
          $record = [pscustomobject]@{
            id = $old.id
            createdAt = $old.createdAt
            updatedAt = (Get-Date).ToUniversalTime().ToString('o')
            status = $old.status
            data = $data
          }
          $apps[$idx] = $record
          Write-Apps $apps.ToArray()
          Send-Json $res $record
          continue
        }

        if ($req.HttpMethod -eq 'DELETE' -and $path -match '^/api/applications/([^/]+)$') {
          $id = $Matches[1]
          $before = $apps.Count
          $remaining = @($apps | Where-Object { $_.id -ne $id })
          if ($remaining.Count -eq $before) { Send-Json $res @{ error = 'not found' } 404; continue }
          Write-Apps $remaining
          Send-Json $res @{ ok = $true }
          continue
        }

        Send-Json $res @{ error = 'Not found' } 404
        continue
      }

      $rel = $path.TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
      if ($rel.EndsWith('/')) { $rel += 'index.html' }
      $file = Join-Path $Public ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
      $full = [IO.Path]::GetFullPath($file)
      $pubFull = [IO.Path]::GetFullPath($Public)
      if (-not $full.StartsWith($pubFull)) {
        Send-Text $res 'Forbidden' 403 'text/plain'
        continue
      }
      if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-Text $res 'Not Found' 404 'text/plain'
        continue
      }
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.StatusCode = 200
      $res.ContentType = Get-Mime $full
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.OutputStream.Close()
    } catch {
      try { Send-Json $res @{ error = $_.Exception.Message } 500 } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

$ErrorActionPreference = "Stop"

$textsDirectory = Join-Path $PSScriptRoot "texte"
if (-not (Test-Path -LiteralPath $textsDirectory -PathType Container)) {
  throw "Der Ordner texte wurde nicht gefunden: $textsDirectory"
}

$songs = @(
  Get-ChildItem -LiteralPath $textsDirectory -Filter "*.txt" -File |
    Sort-Object -Property Name |
    ForEach-Object {
      $contents = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
      $lines = $contents -split "\r?\n"
      $titleIndex = 0
      while ($titleIndex -lt $lines.Count -and [string]::IsNullOrWhiteSpace($lines[$titleIndex])) {
        $titleIndex++
      }

      if ($titleIndex -lt $lines.Count -and $titleIndex + 1 -lt $lines.Count) {
        $title = $lines[$titleIndex].Trim()
        $text = ($lines[($titleIndex + 1)..($lines.Count - 1)] -join "`n").Trim()
        if ($title -and $text) {
          [PSCustomObject]@{
            title = $title
            text = $text
          }
        }
      }
    }
)

$json = ConvertTo-Json -InputObject @($songs) -Depth 4 -Compress
$output = "window.ST_MARTIN_SONGS = $json;"
$catalogPath = Join-Path $textsDirectory "songs.js"
[System.IO.File]::WriteAllText($catalogPath, $output, [System.Text.UTF8Encoding]::new($false))

Write-Host "$($songs.Count) Lied(er) in texte\songs.js geschrieben."

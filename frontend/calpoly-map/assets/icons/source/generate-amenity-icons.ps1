param(
  [string]$SpecPath = (Join-Path $PSScriptRoot "icon-spec.json"),
  [string]$OutputDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-ColorFromHex {
  param(
    [Parameter(Mandatory = $true)][string]$Hex,
    [int]$Alpha = 255
  )

  $clean = $Hex.TrimStart("#")
  if ($clean.Length -ne 6) {
    throw "Expected RGB hex color in #RRGGBB format. Received: $Hex"
  }

  $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb($Alpha, $r, $g, $b)
}

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Width, $Height))
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function Add-BadgePath {
  param(
    [System.Drawing.Drawing2D.GraphicsPath]$Path,
    [object]$BadgeSpec
  )

  $rounded = New-RoundedRectPath -X $BadgeSpec.x -Y $BadgeSpec.y -Width $BadgeSpec.width -Height $BadgeSpec.height -Radius $BadgeSpec.radius
  $Path.AddPath($rounded, $false)
  $rounded.Dispose()

  $centerX = [float]$BadgeSpec.x + ([float]$BadgeSpec.width / 2.0)
  $baseY = [float]$BadgeSpec.y + [float]$BadgeSpec.height - 1
  $triangle = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new([float]$BadgeSpec.tip.leftX, $baseY),
    [System.Drawing.PointF]::new($centerX, [float]$BadgeSpec.tip.tipY),
    [System.Drawing.PointF]::new([float]$BadgeSpec.tip.rightX, $baseY)
  )
  $Path.AddPolygon($triangle)
}

function New-GlyphRect {
  param([object]$BadgeSpec)
  return [System.Drawing.RectangleF]::new(
    [float]$BadgeSpec.x + 9.0,
    [float]$BadgeSpec.y + 8.0,
    [float]$BadgeSpec.width - 18.0,
    [float]$BadgeSpec.height - 16.0
  )
}

function Draw-WaterGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$PrimaryColor,
    [double]$StrokeWidth
  )

  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }

  # Stylized figure-at-fountain glyph inspired by standard water-fountain signage.
  $lineWidth = [float]([Math]::Max(1.7 * $sx, ($StrokeWidth - 0.8) * $sx))
  $pen = [System.Drawing.Pen]::new($PrimaryColor, $lineWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)

  # Person (head + leaning body/arm).
  $Graphics.FillEllipse($brush, (&$toX 10.1), (&$toY 2.3), [float](4.8 * $sx), [float](4.8 * $sy))
  $Graphics.DrawLine($pen, (&$toX 12.2), (&$toY 7.5), (&$toX 8.0), (&$toY 10.0))
  $Graphics.DrawLine($pen, (&$toX 8.0), (&$toY 10.0), (&$toX 8.0), (&$toY 20.0))
  $Graphics.DrawLine($pen, (&$toX 12.0), (&$toY 10.1), (&$toX 15.0), (&$toY 13.4))
  $Graphics.DrawLine($pen, (&$toX 15.0), (&$toY 13.4), (&$toX 16.5), (&$toY 15.5))

  # Fountain basin + stand.
  $basin = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 14.0), (&$toY 10.8)),
    [System.Drawing.PointF]::new((&$toX 21.2), (&$toY 10.8)),
    [System.Drawing.PointF]::new((&$toX 21.2), (&$toY 16.5)),
    [System.Drawing.PointF]::new((&$toX 17.8), (&$toY 16.5)),
    [System.Drawing.PointF]::new((&$toX 14.0), (&$toY 12.8))
  )
  $Graphics.FillPolygon($brush, $basin)
  $Graphics.DrawLine($pen, (&$toX 20.9), (&$toY 16.5), (&$toX 20.9), (&$toY 20.2))

  # Water droplets.
  $droplets = @(
    @{ x = 16.6; y = 8.1; r = 1.15 },
    @{ x = 18.2; y = 7.2; r = 1.05 },
    @{ x = 19.8; y = 7.5; r = 1.05 },
    @{ x = 17.7; y = 9.1; r = 0.9 },
    @{ x = 19.2; y = 9.4; r = 0.9 }
  )
  foreach ($drop in $droplets) {
    $diamX = [float](2.0 * $drop.r * $sx)
    $diamY = [float](2.0 * $drop.r * $sy)
    $Graphics.FillEllipse(
      $brush,
      [float]((&$toX $drop.x) - ($diamX / 2.0)),
      [float]((&$toY $drop.y) - ($diamY / 2.0)),
      $diamX,
      $diamY
    )
  }

  $brush.Dispose()
  $pen.Dispose()
}

function Draw-BathroomGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$PrimaryColor,
    [double]$StrokeWidth
  )

  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }

  $pen = [System.Drawing.Pen]::new($PrimaryColor, [float](($StrokeWidth - 0.4) * $sx))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)

  # Left figure
  $Graphics.FillEllipse($brush, (&$toX 4.8), (&$toY 4.4), [float](4.1 * $sx), [float](4.1 * $sy))
  $Graphics.DrawLine($pen, (&$toX 6.85), (&$toY 8.8), (&$toX 6.85), (&$toY 15.8))
  $Graphics.DrawLine($pen, (&$toX 4.3), (&$toY 11.3), (&$toX 9.4), (&$toY 11.3))
  $Graphics.DrawLine($pen, (&$toX 6.85), (&$toY 15.8), (&$toX 5.1), (&$toY 20))
  $Graphics.DrawLine($pen, (&$toX 6.85), (&$toY 15.8), (&$toX 8.6), (&$toY 20))

  # Right figure
  $Graphics.FillEllipse($brush, (&$toX 15), (&$toY 4.4), [float](4.1 * $sx), [float](4.1 * $sy))
  $dress = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 17.05), (&$toY 9.0)),
    [System.Drawing.PointF]::new((&$toX 12.9), (&$toY 16.4)),
    [System.Drawing.PointF]::new((&$toX 21.2), (&$toY 16.4))
  )
  $Graphics.FillPolygon($brush, $dress)
  $Graphics.DrawLine($pen, (&$toX 14.3), (&$toY 11.4), (&$toX 19.8), (&$toY 11.4))
  $Graphics.DrawLine($pen, (&$toX 15.5), (&$toY 16.4), (&$toX 15.1), (&$toY 20))
  $Graphics.DrawLine($pen, (&$toX 18.6), (&$toY 16.4), (&$toX 19.0), (&$toY 20))

  $brush.Dispose()
  $pen.Dispose()
}

function Draw-PrinterGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$PrimaryColor,
    [System.Drawing.Color]$DetailColor
  )

  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }

  $primaryBrush = [System.Drawing.SolidBrush]::new($PrimaryColor)
  $detailPen = [System.Drawing.Pen]::new($DetailColor, [float](1.4 * $sx))
  $detailPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $detailBrush = [System.Drawing.SolidBrush]::new($DetailColor)

  $paperRect = [System.Drawing.RectangleF]::new((&$toX 7), (&$toY 3.5), [float](10.0 * $sx), [float](6.4 * $sy))
  $bodyRect = [System.Drawing.RectangleF]::new((&$toX 4), (&$toY 9), [float](16.0 * $sx), [float](11.7 * $sy))
  $trayRect = [System.Drawing.RectangleF]::new((&$toX 7), (&$toY 16), [float](10.0 * $sx), [float](4.2 * $sy))

  $Graphics.FillRectangle($primaryBrush, $paperRect)
  $Graphics.FillRectangle($primaryBrush, $bodyRect)
  $Graphics.FillRectangle($primaryBrush, $trayRect)

  $Graphics.DrawRectangle($detailPen, $paperRect.X, $paperRect.Y, $paperRect.Width, $paperRect.Height)
  $Graphics.DrawLine($detailPen, (&$toX 5.5), (&$toY 12.4), (&$toX 18.5), (&$toY 12.4))
  $Graphics.DrawLine($detailPen, (&$toX 8), (&$toY 17.8), (&$toX 16), (&$toY 17.8))
  $Graphics.FillEllipse($detailBrush, (&$toX 16.8), (&$toY 10.1), [float](1.8 * $sx), [float](1.8 * $sy))

  $detailBrush.Dispose()
  $detailPen.Dispose()
  $primaryBrush.Dispose()
}

function Draw-ElevatorGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$PrimaryColor,
    [double]$StrokeWidth
  )

  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }

  $lineWidth = [float]([Math]::Max(1.5 * $sx, ($StrokeWidth - 1.0) * $sx))
  $pen = [System.Drawing.Pen]::new($PrimaryColor, $lineWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)

  # Elevator shaft + center split doors.
  $Graphics.DrawRectangle(
    $pen,
    (&$toX 5.2),
    (&$toY 4.4),
    [float](13.6 * $sx),
    [float](15.8 * $sy)
  )
  $Graphics.DrawLine($pen, (&$toX 12), (&$toY 4.4), (&$toX 12), (&$toY 20.2))

  # Direction arrows.
  $upArrow = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 12), (&$toY 1.9)),
    [System.Drawing.PointF]::new((&$toX 9.4), (&$toY 4.8)),
    [System.Drawing.PointF]::new((&$toX 14.6), (&$toY 4.8))
  )
  $downArrow = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 12), (&$toY 22.3)),
    [System.Drawing.PointF]::new((&$toX 9.4), (&$toY 19.4)),
    [System.Drawing.PointF]::new((&$toX 14.6), (&$toY 19.4))
  )
  $Graphics.FillPolygon($brush, $upArrow)
  $Graphics.FillPolygon($brush, $downArrow)

  $brush.Dispose()
  $pen.Dispose()
}

function Draw-FavoritesGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$PrimaryColor
  )

  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }

  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)

  # Centered 5-point star, sized to match the visual weight of the other glyphs.
  $star = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 12.0), (&$toY 2.8)),
    [System.Drawing.PointF]::new((&$toX 14.3), (&$toY 8.1)),
    [System.Drawing.PointF]::new((&$toX 20.1), (&$toY 8.7)),
    [System.Drawing.PointF]::new((&$toX 15.7), (&$toY 12.5)),
    [System.Drawing.PointF]::new((&$toX 17.0), (&$toY 18.2)),
    [System.Drawing.PointF]::new((&$toX 12.0), (&$toY 15.1)),
    [System.Drawing.PointF]::new((&$toX 7.0), (&$toY 18.2)),
    [System.Drawing.PointF]::new((&$toX 8.3), (&$toY 12.5)),
    [System.Drawing.PointF]::new((&$toX 3.9), (&$toY 8.7)),
    [System.Drawing.PointF]::new((&$toX 9.7), (&$toY 8.1))
  )

  $Graphics.FillPolygon($brush, $star)
  $brush.Dispose()
}

$resolvedSpecPath = (Resolve-Path $SpecPath).Path
$resolvedOutputDir = (Resolve-Path $OutputDir).Path

$spec = Get-Content -Raw $resolvedSpecPath | ConvertFrom-Json
$canvasSize = [int]$spec.canvasSize
$badgeSpec = $spec.badge
$glyphSpec = $spec.glyph

foreach ($icon in $spec.icons) {
  $bitmap = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $badgePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    Add-BadgePath -Path $badgePath -BadgeSpec $badgeSpec

    $fillBrush = [System.Drawing.SolidBrush]::new((New-ColorFromHex $icon.fillColor))
    $strokePen = [System.Drawing.Pen]::new((New-ColorFromHex $badgeSpec.strokeColor), [float]$badgeSpec.strokeWidth)
    $strokePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $graphics.FillPath($fillBrush, $badgePath)
    $graphics.DrawPath($strokePen, $badgePath)

    $glyphRect = New-GlyphRect -BadgeSpec $badgeSpec
    $glyphPrimary = New-ColorFromHex $glyphSpec.primaryColor
    $glyphDetail = New-ColorFromHex $glyphSpec.detailColor

    switch ($icon.glyph) {
      "water" {
        Draw-WaterGlyph -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth
      }
      "bathroom" {
        Draw-BathroomGlyph -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth
      }
      "printer" {
        Draw-PrinterGlyph -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -DetailColor $glyphDetail
      }
      "elevator" {
        Draw-ElevatorGlyph -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth
      }
      "favorites" {
        Draw-FavoritesGlyph -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary
      }
      default {
        throw "Unsupported glyph type '$($icon.glyph)' in spec."
      }
    }

    $outputPath = Join-Path $resolvedOutputDir $icon.filename
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Generated $outputPath"

    $strokePen.Dispose()
    $fillBrush.Dispose()
    $badgePath.Dispose()
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

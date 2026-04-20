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
  if ($clean.Length -ne 6) { throw "Expected RGB hex color in #RRGGBB format. Received: $Hex" }
  $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb($Alpha, $r, $g, $b)
}

function New-RoundedRectPath {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
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
  param([System.Drawing.Drawing2D.GraphicsPath]$Path, [object]$BadgeSpec)
  $rounded = New-RoundedRectPath -X $BadgeSpec.x -Y $BadgeSpec.y -Width $BadgeSpec.width -Height $BadgeSpec.height -Radius $BadgeSpec.radius
  $Path.AddPath($rounded, $false)
  $rounded.Dispose()
  $centerX = [float]$BadgeSpec.x + ([float]$BadgeSpec.width / 2.0)
  $baseY   = [float]$BadgeSpec.y + [float]$BadgeSpec.height - 1
  $triangle = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new([float]$BadgeSpec.tip.leftX,  $baseY),
    [System.Drawing.PointF]::new($centerX,                     [float]$BadgeSpec.tip.tipY),
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

  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)
  $sw = [float]([Math]::Max(1.5 * $sx, ($StrokeWidth - 0.3) * $sx))
  $pen = [System.Drawing.Pen]::new($PrimaryColor, $sw)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  # Faucet
  $faucet = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 9.5),  (&$toY 2.0)),   # top-left of horizontal body
    [System.Drawing.PointF]::new((&$toX 21.5), (&$toY 2.0)),   # top-right
    [System.Drawing.PointF]::new((&$toX 21.5), (&$toY 6.5)),   # bottom-right of body
    [System.Drawing.PointF]::new((&$toX 13.5), (&$toY 6.5)),   # bend point (body bottom)
    [System.Drawing.PointF]::new((&$toX 13.5), (&$toY 8.0)),   # spout tip right
    [System.Drawing.PointF]::new((&$toX 9.5),  (&$toY 8.0))    # spout tip left
  )
  $Graphics.FillPolygon($brush, $faucet)

  # Valve / handle
  $Graphics.FillRectangle($brush,
    (&$toX 17.0), (&$toY 0.0),
    [float](4.5 * $sx), [float](2.2 * $sy))

  # Drinking glass
  $Graphics.DrawLine($pen, (&$toX 2.0),  (&$toY 12.0), (&$toX 19.0), (&$toY 12.0))  # top rim
  $Graphics.DrawLine($pen, (&$toX 2.0),  (&$toY 12.0), (&$toX 4.5),  (&$toY 23.5))  # left side
  $Graphics.DrawLine($pen, (&$toX 19.0), (&$toY 12.0), (&$toX 16.5), (&$toY 23.5))  # right side
  $Graphics.DrawLine($pen, (&$toX 4.5),  (&$toY 23.5), (&$toX 16.5), (&$toY 23.5))  # bottom

  # Water wave inside the glass
  $waveY = [float]((&$toY 18.0))
  $wAmp  = [float](1.1 * $sy)
  $wavePoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 5.2),  $waveY),
    [System.Drawing.PointF]::new((&$toX 7.8),  [float]($waveY - $wAmp)),
    [System.Drawing.PointF]::new((&$toX 10.5), $waveY),
    [System.Drawing.PointF]::new((&$toX 13.2), [float]($waveY + $wAmp)),
    [System.Drawing.PointF]::new((&$toX 15.8), $waveY)
  )
  $Graphics.DrawCurve($pen, $wavePoints, [float]0.45)

  $brush.Dispose()
  $pen.Dispose()
}

function Draw-ManFigure {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$Color,
    [double]$StrokeWidth,
    [double]$CenterFrac = 0.5
  )
  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $cx = $Rect.X + $Rect.Width * $CenterFrac
  $toX = { param([double]$x) [float]($cx + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }
  $pen = [System.Drawing.Pen]::new($Color, [float](($StrokeWidth - 0.4) * $sx))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillEllipse($brush, (&$toX -2.05), (&$toY 4.4), [float](4.1 * $sx), [float](4.1 * $sy))
  $Graphics.DrawLine($pen, (&$toX 0.0), (&$toY 8.8), (&$toX 0.0), (&$toY 15.8))
  $Graphics.DrawLine($pen, (&$toX -2.55), (&$toY 11.3), (&$toX 2.55), (&$toY 11.3))
  $Graphics.DrawLine($pen, (&$toX 0.0), (&$toY 15.8), (&$toX -1.75), (&$toY 20))
  $Graphics.DrawLine($pen, (&$toX 0.0), (&$toY 15.8), (&$toX 1.75), (&$toY 20))
  $brush.Dispose()
  $pen.Dispose()
}

function Draw-WomanFigure {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$Color,
    [double]$StrokeWidth,
    [double]$CenterFrac = 0.5
  )
  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $cx = $Rect.X + $Rect.Width * $CenterFrac
  $toX = { param([double]$x) [float]($cx + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }
  $pen = [System.Drawing.Pen]::new($Color, [float](($StrokeWidth - 0.4) * $sx))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillEllipse($brush, (&$toX -2.05), (&$toY 4.4), [float](4.1 * $sx), [float](4.1 * $sy))
  $dress = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 0.0),   (&$toY 9.0)),
    [System.Drawing.PointF]::new((&$toX -4.15), (&$toY 16.4)),
    [System.Drawing.PointF]::new((&$toX 4.15),  (&$toY 16.4))
  )
  $Graphics.FillPolygon($brush, $dress)
  $Graphics.DrawLine($pen, (&$toX -2.75), (&$toY 11.4), (&$toX 2.75), (&$toY 11.4))
  $Graphics.DrawLine($pen, (&$toX -1.55), (&$toY 16.4), (&$toX -1.95), (&$toY 20))
  $Graphics.DrawLine($pen, (&$toX 1.55),  (&$toY 16.4), (&$toX 1.95),  (&$toY 20))
  $brush.Dispose()
  $pen.Dispose()
}

function Draw-BathroomMenGlyph {
  param([System.Drawing.Graphics]$Graphics, [System.Drawing.RectangleF]$Rect, [System.Drawing.Color]$PrimaryColor, [double]$StrokeWidth)
  Draw-ManFigure -Graphics $Graphics -Rect $Rect -Color $PrimaryColor -StrokeWidth $StrokeWidth -CenterFrac 0.5
}

function Draw-BathroomWomenGlyph {
  param([System.Drawing.Graphics]$Graphics, [System.Drawing.RectangleF]$Rect, [System.Drawing.Color]$PrimaryColor, [double]$StrokeWidth)
  Draw-WomanFigure -Graphics $Graphics -Rect $Rect -Color $PrimaryColor -StrokeWidth $StrokeWidth -CenterFrac 0.5
}

function Draw-BathroomBothGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [System.Drawing.Color]$PrimaryColor,
    [double]$StrokeWidth,
    [System.Drawing.Color]$LeftFillColor,
    [System.Drawing.Color]$RightFillColor,
    [object]$BadgeSpec
  )
  $canvasW = [float]($BadgeSpec.x + $BadgeSpec.width)
  $midX    = [float]($BadgeSpec.x + $BadgeSpec.width / 2.0)

  $leftClip = [System.Drawing.Region]::new([System.Drawing.RectangleF]::new(0, 0, $midX, $canvasW))
  $savedClip = $Graphics.Clip
  $Graphics.Clip = $leftClip
  $leftBadgePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  Add-BadgePath -Path $leftBadgePath -BadgeSpec $BadgeSpec
  $leftBrush = [System.Drawing.SolidBrush]::new($LeftFillColor)
  $Graphics.FillPath($leftBrush, $leftBadgePath)
  $leftBrush.Dispose(); $leftBadgePath.Dispose()
  Draw-ManFigure -Graphics $Graphics -Rect $Rect -Color $PrimaryColor -StrokeWidth $StrokeWidth -CenterFrac 0.28
  $Graphics.Clip = $savedClip; $leftClip.Dispose()

  $rightClip = [System.Drawing.Region]::new([System.Drawing.RectangleF]::new($midX, 0, $canvasW, $canvasW))
  $Graphics.Clip = $rightClip
  $rightBadgePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  Add-BadgePath -Path $rightBadgePath -BadgeSpec $BadgeSpec
  $rightBrush = [System.Drawing.SolidBrush]::new($RightFillColor)
  $Graphics.FillPath($rightBrush, $rightBadgePath)
  $rightBrush.Dispose(); $rightBadgePath.Dispose()
  Draw-WomanFigure -Graphics $Graphics -Rect $Rect -Color $PrimaryColor -StrokeWidth $StrokeWidth -CenterFrac 0.72
  $Graphics.Clip = $savedClip

  $borderPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  Add-BadgePath -Path $borderPath -BadgeSpec $BadgeSpec
  $strokePen = [System.Drawing.Pen]::new((New-ColorFromHex $BadgeSpec.strokeColor), [float]$BadgeSpec.strokeWidth)
  $strokePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Graphics.DrawPath($strokePen, $borderPath)
  $strokePen.Dispose(); $borderPath.Dispose()
}

function Draw-PrinterGlyph {
  param([System.Drawing.Graphics]$Graphics, [System.Drawing.RectangleF]$Rect, [System.Drawing.Color]$PrimaryColor, [System.Drawing.Color]$DetailColor)

  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }

  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)

  # Document/ paper
  $docPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $docPoly = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 5.5),  (&$toY 0.5)),   # top-left
    [System.Drawing.PointF]::new((&$toX 15.5), (&$toY 0.5)),   # top, before fold notch
    [System.Drawing.PointF]::new((&$toX 15.5), (&$toY 4.0)),   # fold notch inner corner
    [System.Drawing.PointF]::new((&$toX 18.5), (&$toY 4.0)),   # fold notch right
    [System.Drawing.PointF]::new((&$toX 18.5), (&$toY 14.0)),  # bottom-right
    [System.Drawing.PointF]::new((&$toX 5.5),  (&$toY 14.0))   # bottom-left
  )
  $docPath.AddPolygon($docPoly)

  # Short title line 
  $docPath.AddRectangle([System.Drawing.RectangleF]::new(
    (&$toX 8.0), (&$toY 5.5), [float](6.5 * $sx), [float](1.5 * $sy)))
  # Full text line
  $docPath.AddRectangle([System.Drawing.RectangleF]::new(
    (&$toX 7.5), (&$toY 8.0), [float](9.5 * $sx), [float](1.5 * $sy)))
  # Full text line
  $docPath.AddRectangle([System.Drawing.RectangleF]::new(
    (&$toX 7.5), (&$toY 10.5), [float](9.5 * $sx), [float](1.5 * $sy)))

  $Graphics.FillPath($brush, $docPath)
  $docPath.Dispose()

  # Printer body 
  $bodyPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $outerBody = New-RoundedRectPath `
    -X      (&$toX 1.5) `
    -Y      (&$toY 10.5) `
    -Width  ([float](21.0 * $sx)) `
    -Height ([float](12.5 * $sy)) `
    -Radius ([float](2.5 * $sx))
  $bodyPath.AddPath($outerBody, $false)
  $outerBody.Dispose()

  # Paper output
  $bodyPath.AddRectangle([System.Drawing.RectangleF]::new(
    (&$toX 4.0), (&$toY 19.5), [float](16.0 * $sx), [float](2.0 * $sy)))
  # Button 
  $bodyPath.AddRectangle([System.Drawing.RectangleF]::new(
    (&$toX 3.0), (&$toY 14.0), [float](3.5 * $sx), [float](1.8 * $sy)))

  $Graphics.FillPath($brush, $bodyPath)
  $bodyPath.Dispose()

  $brush.Dispose()
}

function Draw-ElevatorGlyph {
  param([System.Drawing.Graphics]$Graphics, [System.Drawing.RectangleF]$Rect, [System.Drawing.Color]$PrimaryColor, [double]$StrokeWidth)
  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }
  $lineWidth = [float]([Math]::Max(1.5 * $sx, ($StrokeWidth - 1.0) * $sx))
  $pen = [System.Drawing.Pen]::new($PrimaryColor, $lineWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)
  $Graphics.DrawRectangle($pen, (&$toX 5.2), (&$toY 4.4), [float](13.6 * $sx), [float](15.8 * $sy))
  $Graphics.DrawLine($pen, (&$toX 12), (&$toY 4.4), (&$toX 12), (&$toY 20.2))
  $upArrow = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 12),   (&$toY 1.9)),
    [System.Drawing.PointF]::new((&$toX 9.4),  (&$toY 4.8)),
    [System.Drawing.PointF]::new((&$toX 14.6), (&$toY 4.8))
  )
  $downArrow = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 12),   (&$toY 22.3)),
    [System.Drawing.PointF]::new((&$toX 9.4),  (&$toY 19.4)),
    [System.Drawing.PointF]::new((&$toX 14.6), (&$toY 19.4))
  )
  $Graphics.FillPolygon($brush, $upArrow)
  $Graphics.FillPolygon($brush, $downArrow)
  $brush.Dispose(); $pen.Dispose()
}

function Draw-FavoritesGlyph {
  param([System.Drawing.Graphics]$Graphics, [System.Drawing.RectangleF]$Rect, [System.Drawing.Color]$PrimaryColor)
  $sx = $Rect.Width / 24.0
  $sy = $Rect.Height / 24.0
  $toX = { param([double]$x) [float]($Rect.X + ($x * $sx)) }
  $toY = { param([double]$y) [float]($Rect.Y + ($y * $sy)) }
  $brush = [System.Drawing.SolidBrush]::new($PrimaryColor)
  $star = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$toX 12.0), (&$toY 2.8)),
    [System.Drawing.PointF]::new((&$toX 14.3), (&$toY 8.1)),
    [System.Drawing.PointF]::new((&$toX 20.1), (&$toY 8.7)),
    [System.Drawing.PointF]::new((&$toX 15.7), (&$toY 12.5)),
    [System.Drawing.PointF]::new((&$toX 17.0), (&$toY 18.2)),
    [System.Drawing.PointF]::new((&$toX 12.0), (&$toY 15.1)),
    [System.Drawing.PointF]::new((&$toX 7.0),  (&$toY 18.2)),
    [System.Drawing.PointF]::new((&$toX 8.3),  (&$toY 12.5)),
    [System.Drawing.PointF]::new((&$toX 3.9),  (&$toY 8.7)),
    [System.Drawing.PointF]::new((&$toX 9.7),  (&$toY 8.1))
  )
  $Graphics.FillPolygon($brush, $star)
  $brush.Dispose()
}

# Main

$resolvedSpecPath = (Resolve-Path $SpecPath).Path
$resolvedOutputDir = (Resolve-Path $OutputDir).Path

$spec = Get-Content -Raw $resolvedSpecPath | ConvertFrom-Json
$canvasSize = [int]$spec.canvasSize
$badgeSpec  = $spec.badge
$glyphSpec  = $spec.glyph

foreach ($icon in $spec.icons) {
  $bitmap   = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $glyphRect    = New-GlyphRect -BadgeSpec $badgeSpec
    $glyphPrimary = New-ColorFromHex $glyphSpec.primaryColor
    $glyphDetail  = New-ColorFromHex $glyphSpec.detailColor

    if ($icon.glyph -eq "bathroom-both") {
      $leftColor  = New-ColorFromHex $icon.leftFillColor
      $rightColor = New-ColorFromHex $icon.rightFillColor
      Draw-BathroomBothGlyph `
        -Graphics       $graphics `
        -Rect           $glyphRect `
        -PrimaryColor   $glyphPrimary `
        -StrokeWidth    $glyphSpec.strokeWidth `
        -LeftFillColor  $leftColor `
        -RightFillColor $rightColor `
        -BadgeSpec      $badgeSpec
    }
    else {
      $badgePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
      Add-BadgePath -Path $badgePath -BadgeSpec $badgeSpec
      $fillBrush = [System.Drawing.SolidBrush]::new((New-ColorFromHex $icon.fillColor))
      $strokePen = [System.Drawing.Pen]::new((New-ColorFromHex $badgeSpec.strokeColor), [float]$badgeSpec.strokeWidth)
      $strokePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $graphics.FillPath($fillBrush, $badgePath)
      $graphics.DrawPath($strokePen, $badgePath)

      switch ($icon.glyph) {
        "water"          { Draw-WaterGlyph        -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth }
        "bathroom-men"   { Draw-BathroomMenGlyph  -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth }
        "bathroom-women" { Draw-BathroomWomenGlyph -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth }
        "printer"        { Draw-PrinterGlyph       -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -DetailColor $glyphDetail }
        "elevator"       { Draw-ElevatorGlyph      -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary -StrokeWidth $glyphSpec.strokeWidth }
        "favorites"      { Draw-FavoritesGlyph     -Graphics $graphics -Rect $glyphRect -PrimaryColor $glyphPrimary }
        default          { throw "Unsupported glyph type '$($icon.glyph)' in spec." }
      }

      $strokePen.Dispose(); $fillBrush.Dispose(); $badgePath.Dispose()
    }

    $outputPath = Join-Path $resolvedOutputDir $icon.filename
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Generated $outputPath"
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}
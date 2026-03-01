# Amenity Icon Source and QA

This directory contains the deterministic source-of-truth for amenity marker icons used at runtime in `assets/icons/`.

## Runtime Assets

The generator overwrites these files:

- `../water-fountain.png`
- `../bathroom.png`
- `../printer.png`

## Visual Spec

- Canvas: `64x64` transparent PNG
- Shared badge geometry: same rounded badge + pointer tip for all amenities
- Shared padding and stroke: identical badge dimensions and border thickness
- Category glyphs:
  - Water fountain glyph
  - Bathroom glyph
  - Printer glyph

## Regenerate Icons

From repository root:

```powershell
./frontend/calpoly-map/assets/icons/source/generate-amenity-icons.ps1
```

If you move this script, keep `icon-spec.json` next to it or pass custom paths:

```powershell
./generate-amenity-icons.ps1 -SpecPath ./icon-spec.json -OutputDir ../
```

## QA Checklist

1. Confirm icon files exist and are `64x64`:
   - `water-fountain.png`
   - `bathroom.png`
   - `printer.png`
2. Confirm non-empty rendered bounds (not fully transparent).
3. In app, open **Amenities** mode and verify each category maps to the correct icon.
4. Verify legibility at map zoom levels `13`, `15`, `17`, `19`.
5. Verify contrast in both Light and Dark map styles.
6. Verify amenity popup/selection behavior is unchanged.
7. Confirm fallback behavior for non-target categories (for example, `cafe`) is unchanged.

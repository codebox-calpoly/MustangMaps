#!/usr/bin/env python3
"""Convert building PDFs in assets/floor_plans/ to WebP pages + TS registry.

Usage (from frontend/calpoly-map/):
  python3 scripts/generate_blueprints.py

Requires: pdftoppm (poppler), cwebp (webp).

Inputs:
  assets/floor_plans/building <ref>-N_<name>.pdf
  geojson_files/buildings.geojson

Outputs:
  assets/blueprints/<ref>/page-<N>.webp
  src/config/blueprints.generated.ts
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "assets" / "floor_plans"
OUT_DIR = ROOT / "assets" / "blueprints"
BUILDINGS_GEOJSON = ROOT / "geojson_files" / "buildings.geojson"
MANIFEST_TS = ROOT / "src" / "config" / "blueprints.generated.ts"

DPI = 250
QUALITY = 85

# Refs grouped here all share each other's blueprints: tapping any polygon in
# the group surfaces every PDF from every ref in the group. Refs are stored
# without leading zeros to match the geojson convention.
SHARED_GROUPS: list[frozenset[str]] = [
    frozenset({"10", "22"}),  # Agriculture (010) & English (022)
]

FILENAME_RE = re.compile(r"^building\s+(\d+)-\d+_(.+)\.pdf$", re.I)


def normalize_ref(ref: str) -> str:
    """'010' -> '10', '181' -> '181', '1' -> '1'."""
    try:
        return str(int(ref))
    except ValueError:
        return ref


def pretty_name(raw: str) -> str:
    # 'alan a.erhart agriculture' -> 'Alan A. Erhart Agriculture'
    s = raw.replace("_", " ").strip()
    s = re.sub(r"\s+", " ", s)
    # Add space after period if missing
    s = re.sub(r"\.(?=\S)", ". ", s)
    return s.title().replace(" And ", " and ").replace(" Of ", " of ").replace(" For ", " for ").replace(" The ", " the ")


def load_buildings() -> dict[str, list[dict]]:
    with BUILDINGS_GEOJSON.open() as f:
        data = json.load(f)
    refs: dict[str, list[dict]] = {}
    for feat in data["features"]:
        props = feat.get("properties") or {}
        ref = props.get("ref")
        osm_id = feat.get("id") or props.get("@id")
        name = props.get("name") or ""
        if not ref or not osm_id:
            continue
        refs.setdefault(normalize_ref(str(ref)), []).append({"id": osm_id, "name": name})
    return refs


def convert_pdf(pdf: Path, dest: Path) -> list[str]:
    dest.mkdir(parents=True, exist_ok=True)
    # Clean any previous output for idempotency
    for old in dest.glob("page-*.webp"):
        old.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        prefix = str(Path(tmp) / "p")
        subprocess.run(
            ["pdftoppm", "-r", str(DPI), "-gray", "-png", str(pdf), prefix],
            check=True,
        )
        pngs = sorted(Path(tmp).glob("p-*.png"))
        pages: list[str] = []
        for i, png in enumerate(pngs, start=1):
            webp = dest / f"page-{i}.webp"
            subprocess.run(
                ["cwebp", "-q", str(QUALITY), "-quiet", str(png), "-o", str(webp)],
                check=True,
            )
            pages.append(webp.name)
        return pages


def main() -> int:
    for tool in ("pdftoppm", "cwebp"):
        if not shutil.which(tool):
            print(f"error: {tool} not on PATH", file=sys.stderr)
            return 1
    if not PDF_DIR.is_dir():
        print(f"error: {PDF_DIR} missing", file=sys.stderr)
        return 1

    refs_to_osm = load_buildings()

    # Convert each PDF and remember {ref, name, pages}
    processed: list[dict] = []
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        m = FILENAME_RE.match(pdf.name)
        if not m:
            print(f"skip (filename): {pdf.name}")
            continue
        ref = normalize_ref(m.group(1))
        name = pretty_name(m.group(2))
        print(f"converting ref={ref} ({name})...")
        pages = convert_pdf(pdf, OUT_DIR / ref)
        print(f"  -> {len(pages)} pages")
        processed.append({"ref": ref, "name": name, "pages": pages})

    by_ref = {p["ref"]: p for p in processed}

    # Build osm_id -> list[{ref,name,pages}]
    registry: dict[str, list[dict]] = {}

    def attach(osm_id: str, entry: dict) -> None:
        bucket = registry.setdefault(osm_id, [])
        if not any(b["ref"] == entry["ref"] for b in bucket):
            bucket.append(entry)

    # Shared groups first — every OSM polygon in the group gets every available PDF.
    shared_refs_handled: set[str] = set()
    for group in SHARED_GROUPS:
        osm_ids: list[str] = []
        for r in group:
            for hit in refs_to_osm.get(r, []):
                if hit["id"] not in osm_ids:
                    osm_ids.append(hit["id"])
        entries = [by_ref[r] for r in group if r in by_ref]
        if not osm_ids or not entries:
            continue
        for osm_id in osm_ids:
            for entry in entries:
                attach(osm_id, entry)
        shared_refs_handled.update(r for r in group if r in by_ref)

    # Everyone else: attach PDF to each OSM polygon whose ref matches.
    for p in processed:
        if p["ref"] in shared_refs_handled:
            continue
        hits = refs_to_osm.get(p["ref"], [])
        if not hits:
            print(f"warn: no OSM building with ref={p['ref']!r} for {p['name']}")
            continue
        for hit in hits:
            attach(hit["id"], p)

    # Emit TS manifest
    MANIFEST_TS.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = [
        "// AUTO-GENERATED by scripts/generate_blueprints.py — do not edit.",
        "",
        "export interface BlueprintBuilding {",
        "  ref: string;",
        "  name: string;",
        "  pages: number[];",
        "}",
        "",
        "export const BLUEPRINTS: Record<string, BlueprintBuilding[]> = {",
    ]
    for osm_id in sorted(registry):
        lines.append(f"  {json.dumps(osm_id)}: [")
        for b in registry[osm_id]:
            lines.append("    {")
            lines.append(f"      ref: {json.dumps(b['ref'])},")
            lines.append(f"      name: {json.dumps(b['name'])},")
            lines.append("      pages: [")
            for page in b["pages"]:
                rel = f"../../assets/blueprints/{b['ref']}/{page}"
                lines.append(f"        require({json.dumps(rel)}),")
            lines.append("      ],")
            lines.append("    },")
        lines.append("  ],")
    lines += [
        "};",
        "",
        "export function hasBlueprints(osmId: string | null | undefined): boolean {",
        "  return !!osmId && osmId in BLUEPRINTS;",
        "}",
        "",
        "export const BLUEPRINT_OSM_IDS = new Set<string>(Object.keys(BLUEPRINTS));",
        "",
    ]
    MANIFEST_TS.write_text("\n".join(lines))
    print(f"wrote {MANIFEST_TS.relative_to(ROOT)}")
    print(f"OSM polygons wired: {len(registry)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Merge export (1).geojson into buildings.geojson, avoiding duplicates and inferring amenities."""

import json
import re


def infer_amenity(name):
    """Infer amenity type from building name."""
    if not name:
        return None

    name_lower = name.lower()

    # Academic buildings
    if any(word in name_lower for word in ['engineering', 'graphical arts', 'computer science']):
        return 'engineering_building'
    if any(word in name_lower for word in ['science', 'biology', 'chemistry', 'physics']):
        return 'science_building'
    if 'library' in name_lower:
        return 'library'
    if any(word in name_lower for word in ['business', 'orfalea']):
        return 'business'
    if any(word in name_lower for word in ['mathematics', 'math']):
        return 'mathematics'
    if any(word in name_lower for word in ['architecture', 'environmental design']):
        return 'architecture'
    if any(word in name_lower for word in ['performing arts', 'music', 'davidson']):
        return 'performing_arts'
    if 'theatre' in name_lower or 'theater' in name_lower:
        return 'theatre'

    # Residential
    if any(word in name_lower for word in ['hall', 'residence', 'tower', 'cerro vista', 'poly canyon']):
        return 'dormitory'

    # Dining
    if any(word in name_lower for word in ['dining', 'vista grande', '19 metro', 'campus market']):
        return 'dining'
    if 'starbucks' in name_lower or 'jamba' in name_lower:
        return 'cafe'

    # Recreation
    if any(word in name_lower for word in ['recreation', 'rec center', 'physical education', 'mott']):
        return 'recreation'

    # Administrative
    if any(word in name_lower for word in ['administration', 'services', 'student services', 'admissions']):
        return 'administrative'
    if 'police' in name_lower or 'public safety' in name_lower:
        return 'police'

    # Agriculture
    if any(word in name_lower for word in ['agriculture', 'farm', 'ranch', 'dairy']):
        return 'agriculture'

    # Health
    if 'health' in name_lower or 'medical' in name_lower:
        return 'health'

    # Parking
    if 'parking' in name_lower:
        return 'parking'

    return None


def main():
    # Read both files
    with open('buildings.geojson', 'r') as f:
        buildings = json.load(f)

    with open('export (1).geojson', 'r') as f:
        new_buildings = json.load(f)

    # Create backup
    with open('buildings.geojson.backup3', 'w') as f:
        json.dump(buildings, f, indent=2)
    print(f"Created backup: buildings.geojson.backup3")

    # Get existing building IDs to avoid duplicates
    existing_ids = set()
    for feature in buildings['features']:
        if 'properties' in feature and '@id' in feature['properties']:
            existing_ids.add(feature['properties']['@id'])

    # Merge new buildings
    added_count = 0
    enriched_count = 0

    for feature in new_buildings['features']:
        if 'properties' not in feature:
            continue

        feature_id = feature['properties'].get('@id')

        # Skip if already exists
        if feature_id and feature_id in existing_ids:
            continue

        # Infer amenity if not present
        if 'amenity' not in feature['properties']:
            name = feature['properties'].get('name', '')
            amenity = infer_amenity(name)
            if amenity:
                feature['properties']['amenity'] = amenity
                enriched_count += 1

        # Add to buildings
        buildings['features'].append(feature)
        added_count += 1

    # Write merged file
    with open('buildings.geojson', 'w') as f:
        json.dump(buildings, f, indent=2)

    print(f"Added {added_count} new buildings")
    print(f"Enriched {enriched_count} buildings with amenity field")
    print(f"Total buildings: {len(buildings['features'])}")


if __name__ == '__main__':
    main()
